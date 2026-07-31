"use server";
import { logChange } from "@/lib/chatter-log";
import { query, queryOdg } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { SERVICE_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * **ເຄື່ອງສຳຮອງ (loaner)** — ສູນເອົາເຄື່ອງຂອງຕົນໃຫ້ລູກຄ້າໃຊ້ກ່ອນ ລະຫວ່າງລໍສ້ອມ.
 *
 * ── ຂອບເຂດ (ຕົກລົງ 31-07-2026) ──
 * ① ເປັນ**ຊັບສິນຂອງສູນ** ບໍ່ແມ່ນສິນຄ້າຂາຍ ⇒ **ບໍ່ຕັດສະຕັອກ ERP** ແລະ ບໍ່ອອກເອກະສານເບີກ
 * ② ຜູກ **ISN** ສະເໝີ — ບໍ່ມີເລກ = ຕິດຕາມໜ່ວຍບໍ່ໄດ້ (ຊື່ເຄື່ອງຊ້ຳກັນໄດ້ ເລກປ້າຍບໍ່ຊ້ຳ)
 * ③ ຍັງບໍ່ຮັບຄືນ ⇒ ສົ່ງເຄື່ອງຄືນລູກຄ້າ/ປິດງານບໍ່ໄດ້ (ດ່ານຢູ່ lib/loaner + actions/return)
 *
 * ISN ຊ້ຳກັນ (ໜ່ວຍດຽວຢູ່ 2 ບ້ານ) ຖືກກັນດ້ວຍ unique index ຂອງຖານ ບໍ່ແມ່ນກວດຢູ່ນີ້ຢ່າງດຽວ
 * — ສອງຄົນກົດພ້ອມກັນກໍ່ຜ່ານໄດ້ພຽງຄົນດຽວ.
 */

export type LoanerState = { error?: string; ok?: string };

const lendSchema = z.object({
  job: z.string().trim().min(1),
  isn: z.string().trim().min(1, "ຕ້ອງໃສ່ ISN ຂອງເຄື່ອງສຳຮອງ"),
  item_name: z.string().trim().min(1, "ຕ້ອງໃສ່ຊື່ເຄື່ອງ"),
  item_code: z.string().trim().max(50).optional().default(""),
  note: z.string().trim().max(255).optional().default(""),
});

export async function lendLoaner(_: LoanerState, formData: FormData): Promise<LoanerState> {
  const guard = await requirePermission("/service", "update", SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;

  const parsed = lendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ຂໍ້ມູນບໍ່ຄົບ" };
  const d = parsed.data;

  // ໃບງານຕ້ອງມີຈິງ ແລະ **ຍັງບໍ່ສົ່ງຄືນ** — ສົ່ງເຄື່ອງຄືນໄປແລ້ວບໍ່ມີເຫດຜົນທີ່ຈະໃຫ້ຢືມ
  const job = await query<{ returned: boolean; product: string }>(
    "select return_complete is not null returned, coalesce(name_1,'') product from tb_product where code=$1",
    [d.job],
  );
  if (!job.rows[0]) return { error: "ບໍ່ພົບໃບງານນີ້" };
  if (job.rows[0].returned) return { error: "ໃບງານນີ້ສົ່ງເຄື່ອງຄືນລູກຄ້າໄປແລ້ວ" };

  /**
   * ຮູ້ຈັກໜ່ວຍຈາກ ERP ດ້ວຍ ISN (sn_inventory) — ໄດ້ຊື່/ລະຫັດ/ເລກໂຮງງານທີ່ **ຖືກຕ້ອງ**
   * ໂດຍບໍ່ຕ້ອງເຊື່ອສິ່ງທີ່ browser ສົ່ງມາ. ຫາບໍ່ພົບກໍ່ບໍ່ຫ້າມ — ເຄື່ອງສຳຮອງເກົ່າບາງໜ່ວຍ
   * ບໍ່ມີໃນ ERP ແລ້ວ ⇒ ໃຊ້ຊື່ທີ່ພິມມາແທນ.
   */
  let erp: { item_code: string; item_name: string; sn: string } | null = null;
  try {
    erp =
      (
        await queryOdg<{ item_code: string; item_name: string; sn: string }>(
          `select item_code, coalesce(item_name,'') item_name, coalesce(sn,'') sn
             from sn_inventory
            where replace(coalesce(isn,''),' ','') = replace($1,' ','')
               or replace(coalesce(sn,''),' ','') = replace($1,' ','')
            limit 1`,
          [d.isn],
        )
      ).rows[0] ?? null;
  } catch (error) {
    console.error("lendLoaner ERP lookup failed", error);
  }

  try {
    await query(
      `insert into ods_loaner(job_code,item_code,item_name,isn,sn,lend_by,lend_note)
       values($1,nullif($2,''),$3,$4,nullif($5,''),$6,nullif($7,''))`,
      [
        d.job,
        erp?.item_code ?? d.item_code,
        erp?.item_name || d.item_name,
        d.isn,
        erp?.sn ?? "",
        session.username,
        d.note,
      ],
    );
  } catch (error) {
    // unique index ຂອງ ISN ທີ່ຍັງບໍ່ຄືນ — ໜ່ວຍນີ້ຢູ່ນຳລູກຄ້າອື່ນແລ້ວ
    if (String(error).includes("ods_loaner_isn_open_uniq")) {
      const other = await query<{ job_code: string }>(
        "select job_code from ods_loaner where isn=$1 and return_time is null limit 1",
        [d.isn],
      );
      return { error: `ISN ${d.isn} ຖືກໃຫ້ຢືມຢູ່ໃບງານ ${other.rows[0]?.job_code ?? "ອື່ນ"} ແລ້ວ — ຍັງບໍ່ໄດ້ຮັບຄືນ` };
    }
    console.error("lendLoaner failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  await logChange(
    "tb_product",
    d.job,
    `ໃຫ້ເຄື່ອງສຳຮອງ: ${erp?.item_name || d.item_name} · ISN ${d.isn}${d.note ? ` · ${d.note}` : ""}`,
  );
  revalidatePath(`/service/${d.job}`);
  revalidatePath("/service/loaners");
  return { ok: "ບັນທຶກການໃຫ້ຢືມແລ້ວ" };
}

const returnSchema = z.object({
  id: z.coerce.number().int().positive(),
  job: z.string().trim().min(1),
  note: z.string().trim().max(255).optional().default(""),
});

export async function returnLoaner(_: LoanerState, formData: FormData): Promise<LoanerState> {
  const guard = await requirePermission("/service", "update", SERVICE_SIDE);
  if (!guard.ok) return { error: guard.error };
  const session = guard.session;

  const parsed = returnSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  const d = parsed.data;

  let row: { item_name: string; isn: string } | undefined;
  try {
    row = (
      await query<{ item_name: string; isn: string }>(
        `update ods_loaner set return_time=localtimestamp(0), return_by=$1, return_note=nullif($2,'')
          where id=$3 and job_code=$4 and return_time is null
        returning item_name, isn`,
        [session.username, d.note, d.id, d.job],
      )
    ).rows[0];
  } catch (error) {
    console.error("returnLoaner failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }
  if (!row) return { error: "ບໍ່ພົບລາຍການ ຫຼື ຮັບຄືນໄປແລ້ວ" };

  await logChange(
    "tb_product",
    d.job,
    `ຮັບເຄື່ອງສຳຮອງຄືນ: ${row.item_name} · ISN ${row.isn}${d.note ? ` · ${d.note}` : ""}`,
  );
  revalidatePath(`/service/${d.job}`);
  revalidatePath("/service/loaners");
  return { ok: "ຮັບຄືນແລ້ວ" };
}
