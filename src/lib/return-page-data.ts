import type { Bank, BillHead, Service } from "@/components/return/invoice-editor";
import { db, queryOdg } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";

/**
 * ຂໍ້ມູນຂອງ **ໜ້າສົ່ງຄືນ/ໃບຮັບເງິນ** — ດຶງອອກມາຈາກ page ເພື່ອໃຫ້ **ສອງ route** ໃຊ້ຮ່ວມກັນ:
 *   · /returns/<code>            ງານສ້ອມ
 *   · /claims/jobs/return/<code> ງານເຄມ (ບໍລິບົດ/ລິ້ງກັບຄືນ ຄົນລະຊຸດ)
 * SQL/ກົດເກນຢູ່ບ່ອນດຽວ ⇒ ສອງໜ້ານັ້ນບໍ່ມີວັນຄິດຄົນລະຢ່າງ.
 */
export type Head = BillHead & { used_spare: number | null; status: number | null; cancel_finish: string | null };

export async function getHead(code: string) {
  if (!db) throw new Error("DATABASE_URL is not configured");
  const result = await db.query<Head>(
    `select a.code, a.cust_code, b.name_1 cust_name, b.tel,
        concat_ws(',', b.address, d.name_1, c.name_1) address,
        a.name_1 product, a.p_model model, a.p_brand brand, a.sn, a.warrunty warranty,
        a.issue, a.issue_2, a.emp_code, a.p_access, a.user_regis, a.used_spare, e.product_url,
        a.status, to_char(a.cancel_finish,'DD-MM-YYYY HH24:MI') cancel_finish
     from tb_product a
     left join ar_customer b on b.code = a.cust_code
     left join province c on c.code = b.provine
     left join city d on d.code = b.city and d.province = b.provine
     left join product_image e on e.iteme_code = a.code and e.line_number = 0
     where a.code = $1`,
    [code],
  );
  return result.rows[0] ?? null;
}

/** ບັນຊີທະນາຄານ + ຄ່າບໍລິການ ຢູ່ຖານ ERP (ods ໃຊ້ getcursor2) */
export async function getBanks() {
  return (
    await queryOdg<Bank>(
      `select book_number, name_1,
          (select name_1 from erp_currency where code = a.currency_code) currency,
          currency_code
       from erp_pass_book a
       where currency_code is not null
       order by name_1`,
    )
  ).rows;
}

/**
 * **ລາຍການຄ່າບໍລິການສ້ອມແປງ — ic_inventory ລະຫັດ `9702xx`.**
 *
 * ── ເປັນຫຍັງເຄີຍຫວ່າງ (05-08-2026) ── ມີ 2 ບັກຊ້ອນກັນ:
 *
 * ① **ລະຫັດຜິດໝວດ**: ຄົ້ນ `9900%` ເຊິ່ງແມ່ນ **ຊຸດອາໄຫຼ່ຕິດຕັ້ງແບ່ງຕາມ BTU**
 *    (ເບິ່ງ lib/install-standard) ບໍ່ແມ່ນຄ່າບໍລິການ. ຄ່າບໍລິການແທ້ແມ່ນ
 *    **ສ້ອມ = 9702xx** · ຕິດຕັ້ງ = 9701xx (ເບິ່ງ /receipts ແລະ lib/service-money).
 *    ຫຼັກຖານຈາກໃບຈິງ SIN2026080055: ແຖວຄ່າບໍລິການຄື `970202-0033`
 *    ⇒ `like '9900%'` **ບໍ່ມີວັນຄືນມັນມາໄດ້**.
 *
 * ② **ຖັນຜິດ**: `unit_cost` — ບ່ອນອື່ນທັງລະບົບໃຊ້ `unit_code`. ຖ້າຖັນນັ້ນບໍ່ມີ
 *    query ຈະ throw ແລ້ວຜູ້ເອີ້ນ `.catch(() => [])` ກືນມັນງຽບໆ ⇒ ໜ້າຈໍຂຶ້ນ
 *    "ບໍ່ພົບລາຍການຄ່າບໍລິການ" ທັງທີ່ຄວາມຈິງຄື **query ລົ້ມ**.
 *
 * ⚠️ ຢ່າກືນ error ງຽບໆອີກ — log ໄວ້ບ່ອນນີ້ ຈຶ່ງແຍກ "ບໍ່ມີລາຍການ" ອອກຈາກ
 * "ຖາມຖານບໍ່ໄດ້" ໄດ້ຕອນໄລ່ບັນຫາເທື່ອໜ້າ.
 */
export async function getServices() {
  try {
    return (
      await queryOdg<Service>(
        `select code, name_1, unit_code from ic_inventory where code like '9702%' order by code`,
      )
    ).rows;
  } catch (error) {
    console.error("getServices failed — ດຶງລາຍການຄ່າບໍລິການ (9702xx) ຈາກ ic_inventory ບໍ່ສຳເລັດ", error);
    throw error;
  }
}

/** ເລກບິນທີ່ຈະໄດ້ (ສະແດງເທົ່ານັ້ນ — ຕອນບັນທຶກຈະອອກເລກໃໝ່ໃນ transaction ທີ່ລັອກແລ້ວ) */
export async function previewDocNo() {
  if (!db) return "";
  const client = await db.connect();
  try {
    return await nextDocNo(client, "SIN");
  } finally {
    client.release();
  }
}

