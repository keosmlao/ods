import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * ສິນຄ້າທີ່ເອົາມາສ້ອມ ມີ 3 ປະເພດ:
 *
 *  1. ລູກຄ້າຊື້ໄປຈາກໂອດ້ຽນ  → ຫາໃນ ic_trans_detail (ບິນຂາຍຂອງລູກຄ້າຄົນນັ້ນ)
 *     ອັນນີ້ດີສຸດ ເພາະໄດ້ ບິນ + ວັນທີ → ຄຳນວນການຮັບປະກັນໄດ້
 *  2. ລູກຄ້າບໍ່ໄດ້ຊື້ ແຕ່ມີໃນລາຍການສິນຄ້າຂອງ ERP → ຫາໃນ ic_inventory
 *     ໄດ້ ຍີ່ຫໍ້/Model/ໝວດ ແຕ່ບໍ່ມີບິນ (ຕ້ອງເລືອກການຮັບປະກັນເອງ)
 *  3. ບໍ່ມີໃນລະບົບເລີຍ → ພິມຊື່ເອງ (ຝັ່ງໜ້າຈໍໃຊ້ CreatableSelect)
 *
 * ບໍ່ພິມຫຍັງ → ຄືນສະເພາະປະເພດ 1 (ປະຫວັດການຊື້ຂອງລູກຄ້າ).
 * ພິມຄົ້ນຫາ  → ຄືນທັງ 1 ແລະ 2, ຕິດປ້າຍ source ໃຫ້ຮູ້ວ່າມາຈາກໃສ.
 */

export type ProductSource = "purchase" | "catalog";

type Row = {
  item_code: string;
  item_name: string;
  brand: string;
  model: string;
  product_type: string;
  doc_no: string;
  doc_date: string;
  source: ProductSource;
};

/** ປະເພດ 1 — ສິນຄ້າທີ່ລູກຄ້າຄົນນີ້ຊື້ໄປ */
const PURCHASED_SQL = (filter: string) => `
  select distinct on (d.item_code)
    d.item_code, d.item_name,
    coalesce(i.item_brand,'') brand,
    coalesce(i.item_model,'') model,
    coalesce(i.item_category,'') product_type,
    d.doc_no, to_char(d.doc_date,'YYYY-MM-DD') doc_date,
    'purchase' as source
  from public.ic_trans_detail d
  left join public.ic_inventory i on i.code = d.item_code
  where d.cust_code = $1 and d.trans_type = 2 and d.trans_flag in (30, 44) ${filter}
  order by d.item_code, d.doc_date desc, d.roworder desc
  limit 100`;

/** ປະເພດ 2 — ລາຍການສິນຄ້າຂອງ ERP (ບໍ່ວ່າໃຜຊື້) */
const CATALOG_SQL = `
  select i.code item_code, i.name_1 item_name,
    coalesce(i.item_brand,'') brand,
    coalesce(i.item_model,'') model,
    coalesce(i.item_category,'') product_type,
    '' doc_no, '' doc_date,
    'catalog' as source
  from public.ic_inventory i
  where (i.code ilike $1 or i.name_1 ilike $1) and coalesce(i.name_1,'') <> ''
  order by i.name_1
  limit 30`;

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json([], { status: 401 });

  const customer = request.nextUrl.searchParams.get("customer")?.trim() ?? "";
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const like = `%${q}%`;

  // ບໍ່ພິມ ແລະ ບໍ່ມີລູກຄ້າ → ບໍ່ມີຫຍັງໃຫ້ສະແດງ
  if (!customer && !q) return NextResponse.json([]);

  const [purchased, catalog] = await Promise.all([
    customer
      ? queryOdg<Row>(
          PURCHASED_SQL(q ? "and (d.item_code ilike $2 or d.item_name ilike $2 or d.doc_no ilike $2)" : ""),
          q ? [customer, like] : [customer],
        ).then((result) => result.rows)
      : Promise.resolve([]),
    q ? queryOdg<Row>(CATALOG_SQL, [like]).then((result) => result.rows) : Promise.resolve([]),
  ]);

  // ສິນຄ້າທີ່ຢູ່ໃນປະຫວັດການຊື້ແລ້ວ ບໍ່ຕ້ອງສະແດງຊ້ຳໃນ catalog
  const bought = new Set(purchased.map((row) => row.item_code));
  return NextResponse.json([...purchased, ...catalog.filter((row) => !bought.has(row.item_code))]);
}
