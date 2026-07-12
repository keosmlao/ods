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

/**
 * ໝວດສິນຄ້າ — ສະເພາະໝວດທີ່ **ມີສິນຄ້າຈິງ** ຢູ່ໃນ ERP.
 *
 * ic_category ມີ 325 ແຖວ (ລວມ 'UNIFORM', 'ກອນ', 'ກະຈົກ' …) ⇒ ເທລົງມາທັງໝົດ
 * ຄົນເລືອກບໍ່ຖືກ. ກອງດ້ວຍ exists ⇒ ເຫຼືອສະເພາະໝວດທີ່ໃຊ້ໄດ້ຈິງ.
 */
export async function rateOptions(): Promise<{ categories: Option[] }> {
  const categories = await queryOdg<Option>(
    `select c.code, c.name_1 as name
       from ic_category c
      where coalesce(c.name_1,'') <> ''
        and exists (select 1 from ic_inventory i where i.item_category = c.code)
      order by c.name_1`,
  );
  return { categories: categories.rows };
}

/**
 * ແບບ ແລະ ຂະໜາດ ຂອງ **ໝວດທີ່ເລືອກ** — ກອງຕໍ່ກັນ (cascade).
 *
 * ic_design ມີ 56 ແຖວ ແລະ ic_size ມີ 489 ແຖວ ສຳລັບທຸກໝວດລວມກັນ (ມີ '0.2ລິດ',
 * '3ຊ່ອງ' …). ຖ້າສະແດງທັງໝົດ ຜູ້ຈັດການຈະເລືອກຂະໜາດທີ່ **ໝວດນັ້ນບໍ່ເຄີຍມີ** ໄດ້
 * ⇒ ອັດຕານັ້ນຈະບໍ່ມີວັນຈັບຄູ່ກັບງານໃດເລີຍ (ອັດຕາຕາຍ ໂດຍບໍ່ມີໃຜຮູ້).
 *
 * ດຶງຈາກ **ສິນຄ້າຈິງ** ຂອງໝວດນັ້ນ (ic_inventory) ບໍ່ແມ່ນຈາກຕາຕະລາງ master ລ້ວນ
 * ⇒ ສະແດງແຕ່ຄ່າທີ່ງານຈິງຈະສົ່ງມາໄດ້.
 */
export async function optionsForCategory(
  categoryCode: string,
): Promise<{ designs: Option[]; sizes: Option[] }> {
  if (!categoryCode.trim()) return { designs: [], sizes: [] };

  const [designs, sizes] = await Promise.all([
    queryOdg<Option>(
      `select distinct d.code, d.name_1 as name
         from ic_inventory i
         join ic_design d on d.code = i.item_design
        where i.item_category = $1 and coalesce(d.name_1,'') <> ''
        order by d.name_1`,
      [categoryCode],
    ),
    queryOdg<Option>(
      `select distinct s.code, s.name_1 as name
         from ic_inventory i
         join ic_size s on s.code = i.item_size
        where i.item_category = $1 and coalesce(s.name_1,'') <> ''
        order by s.name_1`,
      [categoryCode],
    ),
  ]);
  return { designs: designs.rows, sizes: sizes.rows };
}

/**
 * ພະນັກງານທີ່ເລືອກເປັນຜູ້ຮັບເງິນໄດ້ — **ຝ່າຍບໍລິການ ຂອງ ERP** (division 400).
 *
 * ⚠️ ໝາຍເຫດເລື່ອງຕົວຕົນ (ສຳຄັນ — ນີ້ເປັນເລື່ອງເງິນ):
 * ງານບັນທຶກຊ່າງໄວ້ເປັນ tech_code / emp_code ເຊິ່ງ **ປົນສອງລະບົບ**:
 *   ຊ່າງ 25 ຄົນທີ່ປາກົດໃນງານ — ມີພຽງ 2 ຄົນທີ່ຄ່າຕົງກັບ odg_employee.employee_code
 *   ອີກ 23 ຄົນເປັນຊື່ຜູ້ໃຊ້ເກົ່າ ('Xiew', 'sak', 'Mee' …) ບໍ່ມີໃນ ERP
 * ⇒ ຜູ້ຮັບເງິນທີ່ເລືອກຈາກນີ້ຈະຖືກເກັບເປັນ employee_code ສ່ວນ **ຊ່າງ** ຍັງເປັນ
 *   ຄ່າທີ່ຢູ່ໃນງານ. ສອງອັນນີ້ເປັນ **ຕົວຕົນຄົນລະອັນ** ແຕ່ບໍ່ຊ້ຳກັນ ⇒ ເງິນບໍ່ຫາຍ
 *   ແລະ ບໍ່ຖືກລວມຜິດຄົນ. ລາຍງານແປງຊື່ຈາກ **ທັງສອງ** ລະບົບ (ເບິ່ງ reports/technician-income)
 *   ຈຶ່ງບໍ່ມີໃຜສະແດງອອກມາເປັນລະຫັດດິບ.
 */
export async function payeeOptions(): Promise<Option[]> {
  const result = await queryOdg<Option>(
    `select e.employee_code as code,
        coalesce(nullif(e.fullname_lo,''), e.employee_code) as name
      from odg_employee e
      where e.employment_status = 'ACTIVE' and e.division_code = '400'
      order by e.fullname_lo`,
  );
  return result.rows;
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
