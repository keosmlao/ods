"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { TRANS } from "@/lib/stock-constants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/** ຖອດແບບຈາກ ods/repair.py: start_repair, show_repar, save_rp */

/** ods ໃຊ້ເວລາ Asia/Bangkok (UTC+7) */
const NOW = "timezone('Asia/Bangkok', now())::timestamp(0)";

export type RepairState = { error?: string };

/**
 * ອາໄຫຼ່ແຖວນີ້ຍັງ "ບໍ່ທັນເຂົ້າເອກະສານ" ບໍ — ຄືຍັງບໍ່ມີໃບຂໍເບີກ (122) ຫຼື ໃບເບີກ (56) ອ້າງເຖິງ.
 *
 * ແຕ່ກ່ອນກັນດ້ວຍ pick_finish ຢ່າງດຽວ ແຕ່ວຽກສ້ອມບໍ່ເຄີຍມີໃຜ stamp pick_finish ເລີຍ
 * (0/3,384 ແຖວ) ⇒ ການປ້ອງກັນບໍ່ເຄີຍເຮັດວຽກ ແລະ ຊ່າງລຶບ/ແກ້ອາໄຫຼ່ທີ່ສາງເບີກອອກໄປແລ້ວໄດ້
 * ເຊິ່ງເຮັດໃຫ້ກະຕ່າກັບເອກະສານສາງບໍ່ຕົງກັນ. ດຽວນີ້ອີງໃສ່ບັນຊີເອກະສານໂດຍກົງ
 * ຈຶ່ງກັນໄດ້ຈິງ ລວມທັງຂໍ້ມູນເກົ່າ.
 */
const NOT_ON_DOC = `pick_finish is null and not exists (
    select 1 from ic_trans_detail d
    where d.product_code = tb_used_spare.product_code and d.item_code = tb_used_spare.item_code
      and d.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}))`;

/* ── ເລີ່ມສ້ອມແປງ (start_repair) ────────────────────────────────── */

export async function startRepair(code: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  await query(`update tb_product set time_repair=${NOW} where code=$1`, [code]);
  await logChange("tb_product", code, "ເລີ່ມສ້ອມແປງ");
  revalidatePath("/repair");
  redirect("/repair");
}

/* ── ອາໄຫຼ່ທີ່ປ່ຽນຈິງຕອນສ້ອມ (tb_used_spare) ─────────────────────
 *
 * ods ໃຫ້ຊ່າງປະກາດອາໄຫຼ່ຕັ້ງແຕ່ຂັ້ນກວດເຊັກເທົ່ານັ້ນ ແລ້ວໜ້າສ້ອມແປງເປັນແຕ່ "ອ່ານ".
 * ຄວາມຈິງແລ້ວ ພໍລົງມືສ້ອມ ອາໄຫຼ່ທີ່ຕ້ອງປ່ຽນມັກປ່ຽນໄປ ຈຶ່ງໃຫ້ແກ້ໄຂໄດ້ຢູ່ຂັ້ນນີ້ນຳ.
 * ── ໝາຍເຫດ: ແຖວທີ່ເບີກອອກສາງແລ້ວ (pick_finish) ຫ້າມແກ້ ຫຼື ລຶບ.
 */

export async function addUsedSpare(
  code: string,
  item: { code: string; name_1: string; unit_code: string | null },
  qty = 1,
) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };

  // ອາໄຫຼ່ຕົວດຽວກັນ ແລະ ຍັງບໍ່ໄດ້ເຂົ້າໃບຂໍເບີກ/ໃບເບີກ → ບວກຈຳນວນເຂົ້າແຖວເກົ່າ.
  // ຖ້າແຖວເກົ່າເຂົ້າເອກະສານໄປແລ້ວ ຕ້ອງແຍກເປັນແຖວໃໝ່ ບໍ່ດັ່ງນັ້ນຈຳນວນໃນກະຕ່າ
  // ຈະບໍ່ຕົງກັບໃບຂໍເບີກທີ່ອອກໄປແລ້ວ.
  const merged = await query(
    `update tb_used_spare set qty = coalesce(qty,0) + $1
      where product_code=$2 and item_code=$3 and ${NOT_ON_DOC}`,
    [qty, code, item.code],
  );
  if (!merged.rowCount) {
    await query(
      `insert into tb_used_spare(product_code, item_code, item_name, qty, unit_code, status, create_date_time_now)
       values($1, $2, $3, $4, $5, '0', ${NOW})`,
      [code, item.code, item.name_1, qty, item.unit_code],
    );
  }

  // ມີອາໄຫຼ່ແລ້ວ → ໝາຍໃບນີ້ວ່າ "ໃຊ້ອາໄຫຼ່"
  await query("update tb_product set used_spare=1 where code=$1", [code]);
  await logChange("tb_product", code, `ເພີ່ມອາໄຫຼ່ທີ່ໃຊ້ສ້ອມ: ${item.name_1} × ${qty}`);
  revalidatePath(`/repair/${code}`);
  return {};
}

export async function updateUsedSpareQty(code: string, rowOrder: number, qty: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };
  const updated = await query<{ item_name: string | null }>(
    `update tb_used_spare set qty=$1 where roworder=$2 and product_code=$3 and ${NOT_ON_DOC}
     returning item_name`,
    [qty, rowOrder, code],
  );
  const name = updated.rows[0]?.item_name;
  if (!name) return { error: "ອາໄຫຼ່ນີ້ເຂົ້າໃບຂໍເບີກແລ້ວ — ແກ້ຈຳນວນບໍ່ໄດ້" };
  await logChange("tb_product", code, `ແກ້ຈຳນວນອາໄຫຼ່ທີ່ໃຊ້ສ້ອມ: ${name} = ${qty}`);
  revalidatePath(`/repair/${code}`);
  return {};
}

export async function deleteUsedSpare(code: string, rowOrder: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  const removed = await query<{ item_name: string | null }>(
    `delete from tb_used_spare where roworder=$1 and product_code=$2 and ${NOT_ON_DOC}
     returning item_name`,
    [rowOrder, code],
  );
  const name = removed.rows[0]?.item_name;
  if (!name) return { error: "ອາໄຫຼ່ນີ້ເຂົ້າໃບຂໍເບີກແລ້ວ — ລຶບບໍ່ໄດ້" };
  // ບໍ່ເຫຼືອອາໄຫຼ່ແລ້ວ → ຍົກທຸງ used_spare ລົງ
  await query(
    `update tb_product set used_spare=0
      where code=$1 and not exists (select 1 from tb_used_spare where product_code=$1)`,
    [code],
  );
  await logChange("tb_product", code, `ຖອດອາໄຫຼ່ອອກຈາກລາຍການສ້ອມ: ${name}`);
  revalidatePath(`/repair/${code}`);
  return {};
}

/* ── ບັນທຶກການສ້ອມແປງ (save_rp) ─────────────────────────────────── */

const saveSchema = z.object({
  pro_code: z.string().min(1),
  repair_note: z.string(),
});

export async function saveRepair(_: RepairState, formData: FormData): Promise<RepairState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  /**
   * save_rp ຂອງ ods ອັບເດດແຕ່ tb_product: status=5 (ລໍຖ້າສົ່ງຄືນ) + time_finish_repair
   * ແລະ ຖິ້ມ "ໝາຍເຫດ" ຂອງຊ່າງ (tb_product.remark ຖືກໃຊ້ເປັນເຫດຜົນຍົກເລີກໄປແລ້ວ).
   * ບ່ອນນີ້ບັນທຶກລົງຄໍລຳ repair_note ທີ່ເພີ່ມໃໝ່ — ວິທີແກ້ໄຂຂອງຊ່າງບໍ່ຫາຍອີກ.
   */
  const { pro_code: code, repair_note: note } = parsed.data;

  try {
    await query(`update tb_product set status=5, time_finish_repair=${NOW}, repair_note=nullif($2,'') where code=$1`, [
      code,
      note,
    ]);
  } catch (error) {
    console.error("save_rp failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  await logChange("tb_product", code, note.trim() ? `ສ້ອມແປງສຳເລັດ: ${note.trim()}` : "ສ້ອມແປງສຳເລັດ");

  revalidatePath("/repair");
  redirect("/repair");
}
