"use server";
import { logChange } from "@/lib/chatter-log";
import { db, query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { MAINTENANCE_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ລະບົບ "ສ້ອມບໍລຸງ" — ສ້າງໃບງານ + ເລື່ອນຂັ້ນ (ຂຽນ timestamp ໃຫ້ MAINTENANCE_STAGE_SQL ອ່ານ).
 * ຄູ່ກັບ actions/installation · actions/repair. ຂັ້ນ: 0 ຮັບແຈ້ງ → 1 ລໍຊ່າງຮັບ → 2 ລໍໄປລ້າງ
 * → 3 ກຳລັງລ້າງ → 4 ລໍ QC → 5 ລໍເກັບເງິນ → 6 ສຳເລັດ.
 */
export type MaintenanceState = { error?: string; code?: string };

type ServiceLine = { service_code?: string | null; name: string; qty?: number; price?: number };

function revalidate(code?: string) {
  revalidatePath("/maintenance");
  if (code) revalidatePath(`/maintenance/${code}`);
}

/** ເປີດງານໃໝ່ — ລູກຄ້າ (walk-in denormalize) + ລາຍການບໍລິການ. */
export async function createMaintenance(formData: FormData): Promise<MaintenanceState> {
  const g = await requireRole(MAINTENANCE_SIDE, "ບໍ່ມີສິດເປີດງານສ້ອມບໍລຸງ");
  if (!g.ok) return { error: g.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const custName = String(formData.get("cust_name") ?? "").trim();
  const custTel = String(formData.get("cust_tel") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const empCode = String(formData.get("emp_code") ?? "").trim();
  const appoint = String(formData.get("appoint_date") ?? "").trim();
  const remark = String(formData.get("remark") ?? "").trim();
  if (!custName) return { error: "ກະລຸນາໃສ່ຊື່ລູກຄ້າ" };

  let lines: ServiceLine[] = [];
  try {
    const raw = String(formData.get("services") ?? "[]");
    lines = JSON.parse(raw) as ServiceLine[];
  } catch {
    return { error: "ຂໍ້ມູນລາຍການບໍລິການບໍ່ຖືກຕ້ອງ" };
  }
  lines = lines.filter((l) => l && l.name?.trim());
  if (lines.length === 0) return { error: "ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ບໍລິການ" };
  const total = lines.reduce((sum, l) => sum + (Number(l.price) || 0) * (Number(l.qty) || 1), 0);

  const client = await db.connect();
  let code = "";
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734212)"); // ກັນເລກຊ້ຳຕອນສ້າງພ້ອມກັນ
    const seq = await client.query<{ max: number | null }>(
      "select max(nullif(regexp_replace(code,'\\D','','g'),'')::int) max from ods_tb_maintenance",
    );
    code = `MC-${(seq.rows[0].max ?? 0) + 1}`;
    await client.query(
      `insert into ods_tb_maintenance
         (code, cust_name, cust_tel, location, emp_code, appoint_date, remark, total, time_register, created_by, assign_time)
       values ($1,$2,$3,$4, nullif($5,''), nullif($6,'')::timestamp, nullif($7,''), $8, localtimestamp(0), $9,
               case when nullif($5,'') is not null then localtimestamp(0) else null end)`,
      [code, custName, custTel, location, empCode, appoint, remark, total, g.session.username],
    );
    for (const l of lines) {
      await client.query(
        `insert into ods_tb_maintenance_detail (job_code, service_code, name, qty, price)
         values ($1, $2, $3, $4, $5)`,
        [code, l.service_code ?? null, l.name.trim(), Number(l.qty) || 1, Number(l.price) || 0],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("createMaintenance failed", error);
    return { error: "ເປີດງານບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("ods_tb_maintenance", code, `ເປີດງານສ້ອມບໍລຸງ ${code} (${custName}) ໂດຍ ${g.session.username}`, { roles: ["manager"] });
  revalidate(code);
  return { code };
}

/** ຈັດຊ່າງ + ນັດ (→ ຂັ້ນ 1 ລໍຊ່າງຮັບ). ວ່າງ emp = ຖອນການຈັດ. */
export async function assignMaintenance(code: string, empCode: string, appoint: string): Promise<MaintenanceState> {
  const g = await requireRole(MAINTENANCE_SIDE, "ບໍ່ມີສິດຈັດຊ່າງ");
  if (!g.ok) return { error: g.error };
  await query(
    `update ods_tb_maintenance
       set emp_code = nullif($2,''), appoint_date = nullif($3,'')::timestamp,
           assign_time = case when nullif($2,'') is not null then coalesce(assign_time, localtimestamp(0)) else null end
     where code = $1`,
    [code.trim(), empCode.trim(), appoint.trim()],
  );
  await logChange("ods_tb_maintenance", code, `ຈັດຊ່າງ ${empCode || "-"} ນັດ ${appoint || "-"} ໂດຍ ${g.session.username}`, { roles: ["manager"] });
  revalidate(code);
  return { code };
}

/** ຂຶ້ນຂັ້ນດ້ວຍການ stamp 1 ຖັນເວລາ (ຖ້າຍັງວ່າງ). col ຖືກຈຳກັດຈາກ ADVANCE ພາຍໃນ. */
const ADVANCE: Record<string, { col: string; label: string }> = {
  accept: { col: "tech_confirm", label: "ຊ່າງຮັບງານ" },
  "start-clean": { col: "start_clean", label: "ເລີ່ມລ້າງ" },
  "finish-clean": { col: "finish_clean", label: "ລ້າງສຳເລັດ" },
  qc: { col: "qc_finish", label: "ຜ່ານ QC" },
};

export async function advanceMaintenance(code: string, step: keyof typeof ADVANCE): Promise<MaintenanceState> {
  const g = await requireRole(MAINTENANCE_SIDE, "ບໍ່ມີສິດປັບປຸງງານ");
  if (!g.ok) return { error: g.error };
  const def = ADVANCE[step];
  if (!def) return { error: "ຂັ້ນບໍ່ຖືກຕ້ອງ" };
  await query(
    `update ods_tb_maintenance set ${def.col} = localtimestamp(0)
       where code = $1 and ${def.col} is null and cancel_date is null`,
    [code.trim()],
  );
  await logChange("ods_tb_maintenance", code, `${def.label} ໂດຍ ${g.session.username}`, { roles: ["manager"] });
  revalidate(code);
  return { code };
}

/** ເກັບເງິນ + ປິດງານ (→ ຂັ້ນ 6 ສຳເລັດ) */
export async function closeMaintenance(code: string): Promise<MaintenanceState> {
  const g = await requireRole(MAINTENANCE_SIDE, "ບໍ່ມີສິດປິດງານ");
  if (!g.ok) return { error: g.error };
  await query(
    `update ods_tb_maintenance
       set paid_at = coalesce(paid_at, localtimestamp(0)), job_finish = localtimestamp(0)
     where code = $1 and cancel_date is null`,
    [code.trim()],
  );
  await logChange("ods_tb_maintenance", code, `ເກັບເງິນ + ປິດງານ ໂດຍ ${g.session.username}`, { roles: ["manager"] });
  revalidate(code);
  return { code };
}

/** ຍົກເລີກງານ */
export async function cancelMaintenance(code: string, reason: string): Promise<MaintenanceState> {
  const g = await requireRole(MAINTENANCE_SIDE, "ບໍ່ມີສິດຍົກເລີກງານ");
  if (!g.ok) return { error: g.error };
  const r = reason.trim();
  if (r.length < 3) return { error: "ກະລຸນາບອກເຫດຜົນ (ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ)" };
  await query(
    `update ods_tb_maintenance set cancel_date = localtimestamp(0), remark = $2 where code = $1`,
    [code.trim(), r],
  );
  await logChange("ods_tb_maintenance", code, `ຍົກເລີກງານ: ${r} (ໂດຍ ${g.session.username})`, { roles: ["manager"] });
  revalidate(code);
  return { code };
}
