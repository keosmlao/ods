"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession } from "@/lib/auth";
import { db, query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * ຖອດແບບຈາກ ods/check.py:
 *   start_check, pro_ch_detail, search_item_spare, additem, updateqty, delete_item,
 *   save_check, cancelchecking
 *
 * ods ໃຊ້ tb_product.roworder ເປັນ id ໃນ URL ແຕ່ໃຊ້ tb_product.code ຕອນບັນທຶກ (save_check).
 * ບ່ອນນີ້ໃຊ້ code ໝົດທຸກບ່ອນ ໃຫ້ຄືກັບ /service/[code].
 */

/** ods ໃຊ້ເວລາ Asia/Bangkok (UTC+7) ຄືກັນກັບລາວ */
const NOW = "timezone('Asia/Bangkok', now())::timestamp(0)";

export type CheckState = { error?: string };

/* ── ຄົ້ນຫາອາໄຫຼ່ (search_item_spare) ───────────────────────────── */

export type SpareItem = {
  code: string;
  name_1: string;
  brand: string | null;
  unit_code: string | null;
  balance_qty: number;
};

/**
 * ຄົ້ນຫາອາໄຫຼ່ຈາກ ic_inventory.
 *
 * ບໍ່ພິມຫຍັງກໍ່ຄືນລາຍການໃຫ້ເລີຍ (ຮຽງຕາມຄົງເຫຼືອຫຼາຍສຸດ) — ods ບັງຄັບໃຫ້ພິມກ່ອນ
 * ຈຶ່ງເບິ່ງຄືວ່າ "ບໍ່ດຶງລາຍການອາໄຫຼ່".
 *
 * ໝາຍເຫດ: ຖັນ part_number ໃນ ic_inventory ຫວ່າງທຸກແຖວ ຈຶ່ງບໍ່ດຶງມາສະແດງ.
 */
export async function searchSpare(q: string, inStockOnly = false): Promise<SpareItem[]> {
  const session = await getSession();
  if (!session) return [];

  const text = q.trim();
  const where: string[] = [];
  const params: string[] = [];

  if (text) {
    params.push(`%${text}%`);
    where.push(`(code ilike $1 or name_1 ilike $1 or item_brand ilike $1)`);
  }
  if (inStockOnly) where.push("coalesce(balance_qty,0) > 0");

  const result = await query<SpareItem>(
    // balance_qty ເປັນ null ໄດ້ → ໃຫ້ເປັນ 0 (ods ສະແດງເປັນຫວ່າງ)
    `select code, name_1, item_brand as brand, unit_code, coalesce(balance_qty,0)::int as balance_qty
       from ic_inventory
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by coalesce(balance_qty,0) desc, code
      limit 50`,
    params,
  );
  return result.rows;
}

/* ── ເລີ່ມກວດເຊັກ (start_check) ─────────────────────────────────── */

export async function startCheck(code: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  await query(`update tb_product set time_check=${NOW}, status=1 where code=$1`, [code]);
  await logChange("tb_product", code, "ເລີ່ມກວດເຊັກ");
  revalidatePath("/checking");
  redirect("/checking");
}

/* ── ກະຕ່າອາໄຫຼ່ (additem / updateqty / delete_item) ─────────────── */

export async function addSpareItem(
  code: string,
  item: { code: string; name_1: string; unit_code: string | null },
  qty = 1,
) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };

  // ods ດຶງ cust_code ຈາກ session (ຄ້າງມາຈາກໜ້າອື່ນ → ມັກຜິດ) — ບ່ອນນີ້ດຶງຈາກ tb_product ໂດຍກົງ
  const product = (await query<{ cust_code: string | null }>("select cust_code from tb_product where code=$1 limit 1", [code])).rows[0];
  if (!product) return { error: "ບໍ່ພົບລາຍການ" };

  // ອາໄຫຼ່ຕົວດຽວກັນເພີ່ມຊ້ຳ → ບວກຈຳນວນເຂົ້າແຖວເກົ່າ ແທນທີ່ຈະສ້າງແຖວຊ້ຳ
  const existing = await query(
    `update ic_trans_detail_draft set qty = coalesce(qty,0) + $1
      where user_created=$2 and product_code=$3 and item_code=$4`,
    [qty, session.username, code, item.code],
  );
  if (existing.rowCount) {
    await logChange("tb_product", code, `ເພີ່ມອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້: ${item.name_1} × ${qty}`);
    revalidatePath(`/checking/${code}`);
    return {};
  }

  await query(
    `insert into ic_trans_detail_draft(trans_flag, cust_code, product_code, item_code, item_name, qty, unit_code, user_created)
     values(12, $1, $2, $3, $4, $5, $6, $7)`,
    [product.cust_code, code, item.code, item.name_1, qty, item.unit_code, session.username],
  );
  await logChange("tb_product", code, `ເພີ່ມອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້: ${item.name_1} × ${qty}`);
  revalidatePath(`/checking/${code}`);
  return {};
}

export async function updateSpareQty(code: string, rowOrder: number, qty: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };
  await query("update ic_trans_detail_draft set qty=$1 where roworder=$2 and user_created=$3 and product_code=$4", [
    qty,
    rowOrder,
    session.username,
    code,
  ]);
  revalidatePath(`/checking/${code}`);
  return {};
}

export async function deleteSpareItem(code: string, rowOrder: number) {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };
  // ເອົາຊື່ອາໄຫຼ່ຄືນມາພ້ອມຕອນລຶບ — ໃຊ້ຂຽນ log ໃຫ້ອ່ານຮູ້ເລື່ອງ
  const removed = await query<{ item_name: string | null }>(
    `delete from ic_trans_detail_draft where roworder=$1 and user_created=$2 and product_code=$3
     returning item_name`,
    [rowOrder, session.username, code],
  );
  const name = removed.rows[0]?.item_name;
  if (name) await logChange("tb_product", code, `ຖອດອາໄຫຼ່ອອກຈາກລາຍການ: ${name}`);
  revalidatePath(`/checking/${code}`);
  return {};
}

/* ── ບັນທຶກການກວດເຊັກ (save_check) ──────────────────────────────── */

const saveSchema = z.object({
  code: z.string().min(1),
  isue_bytech: z.string().min(1),
  war_by_t: z.enum(["0", "1"]),
  t_reason: z.string(),
  use_spare: z.enum(["0", "1"]),
  warrunty: z.string(),
});

export async function saveCheck(_: CheckState, formData: FormData): Promise<CheckState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ກະລຸນາປ້ອນ ອາການຊ່າງວິເຄາະ" };
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const { code, isue_bytech, war_by_t, use_spare, warrunty } = parsed.data;
  // t_reason: ods ຮັບຄ່ານີ້ແຕ່ບໍ່ໄດ້ບັນທຶກລົງ DB — ບ່ອນນີ້ກໍ່ບໍ່ບັນທຶກຄືກັນ

  const usesSpare = use_spare === "1";
  const underWarranty = warrunty === "ຮັບປະກັນ";

  /**
   * ສະຖານະໃໝ່ — ຕາມ check.py save_check() ຢ່າງແທ້ຈິງ:
   *   ໃຊ້ອາໄຫຼ່ + ຮັບປະກັນ      → 3  (ລໍຖ້າສະເໜີລາຄາ)
   *   ໃຊ້ອາໄຫຼ່ + ໝົດຮັບປະກັນ   → 2
   *   ບໍ່ໃຊ້ອາໄຫຼ່ + ຮັບປະກັນ    → 4  (ກຳລັງສະເໜີລາຄາ)
   *   ບໍ່ໃຊ້ອາໄຫຼ່ + ໝົດຮັບປະກັນ → 2
   */
  const status = usesSpare ? (underWarranty ? 3 : 2) : underWarranty ? 4 : 2;

  const client = await db.connect();
  let spareCount = 0;
  try {
    await client.query("begin");

    if (usesSpare) {
      const moved = await client.query(
        `insert into tb_used_spare(product_code, item_code, item_name, qty, unit_code)
         select product_code, item_code, item_name, qty, unit_code
           from ic_trans_detail_draft where user_created=$1 and product_code=$2`,
        [session.username, code],
      );
      spareCount = moved.rowCount ?? 0;
      await client.query("delete from ic_trans_detail_draft where user_created=$1 and product_code=$2", [
        session.username,
        code,
      ]);
    }

    if (usesSpare) {
      await client.query(
        `update tb_product set time_finish_check=${NOW}, used_spare=1, status=$1, issue_2=$2 where code=$3`,
        [status, isue_bytech, code],
      );
    } else {
      await client.query(`update tb_product set time_finish_check=${NOW}, status=$1, issue_2=$2 where code=$3`, [
        status,
        isue_bytech,
        code,
      ]);
    }

    // ຂໍປ່ຽນປະກັນ → ຊ່າງຕັດສິນວ່າໝົດຮັບປະກັນ
    if (war_by_t === "1") {
      await client.query("update tb_product set warrunty='ໝົດຮັບປະກັນ' where code=$1", [code]);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("save_check failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  const spareNote = usesSpare ? `ໃຊ້ອາໄຫຼ່ ${spareCount} ລາຍການ` : "ບໍ່ໃຊ້ອາໄຫຼ່";
  const warrantyNote = war_by_t === "1" ? " · ຊ່າງແຈ້ງວ່າໝົດຮັບປະກັນ" : "";
  await logChange("tb_product", code, `ບັນທຶກຜົນກວດເຊັກ: ${isue_bytech} · ${spareNote}${warrantyNote}`);

  revalidatePath("/checking");
  redirect("/checking");
}

/* ── ຍົກເລີກການກວດເຊັກ (cancelchecking) ─────────────────────────── */

export async function cancelChecking(code: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!db) throw new Error("DATABASE_URL is not configured");

  const client = await db.connect();
  let cancelled = false;
  try {
    await client.query("begin");
    const product = (
      await client.query<{ code: string; used_spare: number | null }>(
        "select code, used_spare from tb_product where code=$1 limit 1",
        [code],
      )
    ).rows[0];

    if (product) {
      cancelled = true;
      if (product.used_spare === 1) {
        await client.query(
          "update tb_product set time_finish_check=null, used_spare=0, status=2, issue_2=null where code=$1",
          [code],
        );
        await client.query("delete from tb_used_spare where product_code=$1", [product.code]);
      } else {
        // ods ບໍ່ໄດ້ຕັ້ງ status ຄືນໃນກໍລະນີນີ້ — ຮັກສາໄວ້ຄືເກົ່າ
        await client.query("update tb_product set time_finish_check=null where code=$1", [code]);
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    cancelled = false;
    console.error("cancelchecking failed", error);
  } finally {
    client.release();
  }

  if (cancelled) await logChange("tb_product", code, "ຍົກເລີກຜົນກວດເຊັກ — ກັບໄປກວດເຊັກຄືນໃໝ່");

  revalidatePath("/checking");
  redirect("/checking");
}
