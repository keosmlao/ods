"use server";
import { getSession } from "@/lib/auth";
import { type Workflow } from "@/lib/commission";
import { db, queryOdg } from "@/lib/db";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * ກຳນົດອັດຕາຄ່າບໍລິການ ແລະ ຜູ້ຮັບເງິນ — **ຜູ້ຈັດການເທົ່ານັ້ນ**.
 * ນີ້ຄືເລື່ອງເງິນ ຈຶ່ງບໍ່ເປີດໃຫ້ role ໃດອື່ນ ແລະ ບໍ່ໃຊ້ກຸ່ມ (SERVICE_SIDE ...) ທີ່ອາດກວ້າງຂຶ້ນມື້ໜ້າ.
 */
export type RateState = { error?: string; ok?: string };

async function requireManager(): Promise<{ ok: true; username: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session ໝົດອາຍຸ" };
  if (roleOf(session) !== "manager") return { ok: false, error: "ຜູ້ຈັດການເທົ່ານັ້ນທີ່ກຳນົດອັດຕາໄດ້" };
  return { ok: true, username: session.username };
}

/* ── ຕົວເລືອກຈາກ ERP (ອ່ານຢ່າງດຽວ) ─────────────────────────────── */

export type Option = { code: string; name: string };

/** ໝວດ / ແບບ / ຂະໜາດ — ມາຈາກ ERP ບ່ອນດຽວ ຈຶ່ງບໍ່ມີທາງຫຼົ້ນກັບຂໍ້ມູນຈິງ */
export async function rateOptions(): Promise<{ categories: Option[]; designs: Option[]; sizes: Option[] }> {
  const [categories, designs, sizes] = await Promise.all([
    queryOdg<Option>("select code, name_1 as name from ic_category where coalesce(name_1,'') <> '' order by name_1"),
    queryOdg<Option>("select code, name_1 as name from ic_design where coalesce(name_1,'') <> '' order by name_1"),
    queryOdg<Option>("select code, name_1 as name from ic_size where coalesce(name_1,'') <> '' order by name_1"),
  ]);
  return { categories: categories.rows, designs: designs.rows, sizes: sizes.rows };
}

/* ── ອັດຕາ ─────────────────────────────────────────────────────── */

const rateSchema = z.object({
  workflow: z.enum(["repair", "install"]),
  service_type: z.string(),
  category_code: z.string(),
  design_code: z.string(),
  size_code: z.string(),
  label: z.string().min(1),
  amount_thb: z.coerce.number().min(0),
});

const blank = (value: string) => (value.trim() === "" ? null : value.trim());

export async function saveRate(_: RateState, formData: FormData): Promise<RateState> {
  const guard = await requireManager();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ — ຕ້ອງມີຄຳອະທິບາຍ ແລະ ຈຳນວນເງິນ" };
  const d = parsed.data;

  await db.query(
    `insert into ods_service_rate(workflow, service_type, category_code, design_code, size_code,
        label, amount_thb, updated_by)
     values($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      d.workflow,
      blank(d.service_type),
      blank(d.category_code),
      blank(d.design_code),
      blank(d.size_code),
      d.label.trim(),
      d.amount_thb,
      guard.username,
    ],
  );

  revalidatePath("/manage/service-rates");
  return { ok: `ເພີ່ມອັດຕາ "${d.label.trim()}" ສຳເລັດ` };
}

/**
 * ປິດອັດຕາ — **ບໍ່ລຶບ**.
 * ods_service_payout ອ້າງອີງ rate_id ໄວ້ ⇒ ລຶບແລ້ວປະຫວັດການຈ່າຍເງິນຈະຊີ້ໄປບ່ອນຫວ່າງ.
 * ປິດແທນ ⇒ ງານໃໝ່ບໍ່ໃຊ້ອັດຕານີ້ອີກ ແຕ່ເງິນທີ່ຈ່າຍໄປແລ້ວຍັງອະທິບາຍໄດ້.
 */
export async function deactivateRate(id: number): Promise<RateState> {
  const guard = await requireManager();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  await db.query(
    `update ods_service_rate set is_active = false, effective_to = current_date,
        updated_by = $2, updated_at = localtimestamp(0)
      where id = $1`,
    [id, guard.username],
  );
  revalidatePath("/manage/service-rates");
  return { ok: "ປິດອັດຕາແລ້ວ" };
}

/* ── ຜູ້ຮັບເງິນຂອງແຕ່ລະບົດບາດ ────────────────────────────────────── */

const payeeSchema = z.object({
  workflow: z.enum(["repair", "install"]),
  role: z.enum(["supervisor", "team_lead", "admin"]),
  employee_code: z.string(),
});

/**
 * ໃຜຮັບເງິນຂອງ ຜູ້ຄຸມ / ຫົວໜ້າທີມ / Admin.
 * **ຊ່າງບໍ່ຢູ່ໃນນີ້** — ເອົາຈາກງານເອງ (ຄົນທີ່ຮັບງານ) ຈຶ່ງບໍ່ມີທາງກຳນົດຜິດຄົນ.
 * ຄ່າຫວ່າງ = ຖອນຜູ້ຮັບອອກ ⇒ ສ່ວນແບ່ງນັ້ນຖືກບັນທຶກແຕ່ຄ້າງລໍຜູ້ຮັບ (ບໍ່ຫາຍ).
 */
export async function savePayee(_: RateState, formData: FormData): Promise<RateState> {
  const guard = await requireManager();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = payeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  const { workflow, role, employee_code: employee } = parsed.data;

  if (!employee.trim()) {
    await db.query("delete from ods_service_commission_payee where workflow=$1 and role=$2", [workflow, role]);
  } else {
    await db.query(
      `insert into ods_service_commission_payee(workflow, role, employee_code, updated_by)
       values($1,$2,$3,$4)
       on conflict (workflow, role) do update
          set employee_code = excluded.employee_code,
              updated_by = excluded.updated_by,
              updated_at = localtimestamp(0)`,
      [workflow, role, employee.trim(), guard.username],
    );
  }

  revalidatePath("/manage/service-rates");
  return { ok: "ບັນທຶກຜູ້ຮັບເງິນສຳເລັດ" };
}

/* ── ເປີເຊັນການແບ່ງ ───────────────────────────────────────────── */

/**
 * ແກ້ເປີເຊັນ — ບັງຄັບໃຫ້ **ລວມເປັນ 100 ພໍດີ** ຕໍ່ສາຍງານ.
 * ບໍ່ດັ່ງນັ້ນເງິນຈະຫາຍ (ລວມ < 100) ຫຼື ຈ່າຍເກີນຄ່າບໍລິການ (> 100) ໂດຍບໍ່ມີໃຜຮູ້.
 */
export async function saveSplit(workflow: Workflow, pcts: Record<string, number>): Promise<RateState> {
  const guard = await requireManager();
  if (!guard.ok) return { error: guard.error };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const total = Object.values(pcts).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 0.001) {
    return { error: `ເປີເຊັນຕ້ອງລວມເປັນ 100 ພໍດີ (ຕອນນີ້ ${total})` };
  }

  const client = await db.connect();
  try {
    await client.query("begin");
    for (const [role, pct] of Object.entries(pcts)) {
      await client.query(
        `insert into ods_service_commission_split(workflow, role, pct) values($1,$2,$3)
         on conflict (workflow, role) do update set pct = excluded.pct`,
        [workflow, role, pct],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveSplit failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  revalidatePath("/manage/service-rates");
  return { ok: "ບັນທຶກເປີເຊັນສຳເລັດ" };
}
