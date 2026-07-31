import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { roleOf, SERVICE_SIDE } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ISN ຂອງສິນຄ້າລາຍການນຶ່ງ — **ໃຊ້ຕອນບິນບໍ່ໄດ້ລົງ ISN ໄວ້**.
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * ປົກກະຕິ ISN ຂອງໜ່ວຍທີ່ຂາຍຢູ່ໃນ sn_trans_detail ຂອງບິນ ⇒ ຟອມເອົາອັນນັ້ນມາໃຫ້ເລືອກ
 * (ເບິ່ງ api/installations/bills). ແຕ່ **ບາງບິນ ERP ບໍ່ໄດ້ລົງ ISN ເລີຍ**
 * (ຕົວຢ່າງຈິງ CAK26008723: ຈັກຊັກ + ຕູ້ເຢັນ ⇒ ISN 0 ແຖວ) ⇒ ຄົນຮັບເຄື່ອງຕ້ອງພິມ S/N
 * ດ້ວຍມື ແລະ ພິມຜິດໄດ້ ⇒ ຮັບປະກັນ/ສ້ອມພາຍຫຼັງອ້າງອີງບໍ່ຖືກໜ່ວຍ.
 *
 * ດຽວນີ້: ຄົ້ນ ISN **ຂອງລາຍການນັ້ນ** ຈາກ sn_inventory (ຄັງ ISN ຂອງບໍລິສັດ — ໜ່ວຍທີ່
 * ຂາຍອອກໄປແລ້ວກໍ່ຍັງຢູ່ ພຽງແຕ່ status ປ່ຽນ) ⇒ ຄົນອ່ານ ISN ຈາກປ້າຍແລ້ວເລືອກເອົາ.
 *
 * ── `doc_ref` (ບິນ) ──
 * ໜ້າ**ແກ້ໄຂງານ** ຮູ້ບິນຂອງງານຢູ່ແລ້ວ (ods_tb_install.doc_ref_1) ⇒ ສົ່ງມານຳ ແລ້ວຈະໄດ້
 * **ໜ່ວຍທີ່ຂາຍໃນບິນນັ້ນຈິງ** ຂຶ້ນກ່ອນ (source='bill') ແລ້ວຄ່ອຍຕໍ່ດ້ວຍຄັງ (source='stock')
 * — ບໍ່ດັ່ງນັ້ນຄົນແກ້ໄຂຕ້ອງເລືອກຈາກ ISN 50 ໜ່ວຍຂອງລາຍການນັ້ນທັງໝົດ ໂດຍບໍ່ຮູ້ວ່າອັນໃດຄື
 * ໜ່ວຍຂອງລູກຄ້າ. ⚠️ ແອ: ISN ຢູ່ **ອົງປະກອບຂອງຊຸດ** ບໍ່ແມ່ນແຖວ [SET] ⇒ ແຕກຜ່ານ
 * ic_inventory_set_detail ຄືກັນກັບ api/installations/bills.
 *
 * ⚠️ sn_inventory **ບໍ່ມີ index ຢູ່ item_code** (seq scan 148k ແຖວ ≈ 80ms) — ຮັບໄດ້
 * ເພາະຄົ້ນຕໍ່ເມື່ອກົດເລືອກລາຍການ. ຖານ ERP ອ່ານຢ່າງດຽວ ⇒ ເພີ່ມ index ບໍ່ໄດ້.
 *
 * ສິດ: matcher ຂອງ src/proxy.ts ຕັດ /api ອອກ ⇒ ກວດ role ເອງ (ຝ່າຍບໍລິການ).
 */
export type SerialRow = {
  isn: string;
  sn: string;
  /** 1 = ຍັງຢູ່ໃນສາງ · 0 = ອອກໄປແລ້ວ (ຂາຍ) — ໜ່ວຍທີ່ຕິດຕັ້ງມັກຈະເປັນ 0 */
  in_stock: boolean;
  /** ໜ່ວຍໃນ/ໜ່ວຍນອກ (ແອ) — ຮູ້ໄດ້ສະເພາະໜ່ວຍທີ່ມາຈາກບິນ */
  part?: string;
  /** ມາຈາກໃສ: ບິນຂອງງານ ຫຼື ຄັງ ISN ຂອງລາຍການ */
  source?: "bill" | "stock";
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SERVICE_SIDE.includes(roleOf(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const itemCode = (request.nextUrl.searchParams.get("item_code") ?? "").trim();
  if (!itemCode) return NextResponse.json({ data: [] });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const docRef = (request.nextUrl.searchParams.get("doc_ref") ?? "").trim();

  try {
    // ① ໜ່ວຍທີ່ **ຂາຍໃນບິນຂອງງານ** — ອັນທີ່ຄົນແກ້ໄຂຢາກໄດ້ 9 ໃນ 10 ເທື່ອ
    const billRows = docRef
      ? (
          await queryOdg<SerialRow>(
            `select d.sn as isn, coalesce(sni.sn,'') as sn,
                (coalesce(sni.status,0) = 1) as in_stock,
                case when d.item_name ilike '%[C]%' then 'ໜ່ວຍໃນ'
                     when d.item_name ilike '%[H]%' then 'ໜ່ວຍນອກ'
                     else '' end as part,
                'bill'::text as source
               from sn_trans_detail d
               left join sn_inventory sni on sni.isn = d.sn
              where d.trans_flag = 44
                and d.doc_ref = $1
                and coalesce(d.sn,'') <> ''
                and (d.item_code = $2
                     or d.item_code in (select sd.ic_code from ic_inventory_set_detail sd
                                         where sd.ic_set_code = $2))
                ${q ? "and (d.sn ilike $3 or sni.sn ilike $3)" : ""}
              order by (d.item_name ilike '%[C]%') desc, d.sn`,
            q ? [docRef, itemCode, `%${q}%`] : [docRef, itemCode],
          )
        ).rows
      : [];

    // ② ຄັງ ISN ຂອງລາຍການ — ທາງອອກເມື່ອບິນບໍ່ໄດ້ລົງ ISN ໄວ້
    const stockRows = (
      await queryOdg<SerialRow>(
        `select s.isn, coalesce(s.sn,'') as sn, (s.status = 1) as in_stock,
            ''::text as part, 'stock'::text as source
           from sn_inventory s
          where s.item_code = $1
            and coalesce(s.isn,'') <> ''
            ${q ? "and (s.isn ilike $2 or s.sn ilike $2)" : ""}
          order by s.create_date_time_now desc
          limit 50`,
        q ? [itemCode, `%${q}%`] : [itemCode],
      )
    ).rows;

    const fromBill = new Set(billRows.map((row) => row.isn));
    return NextResponse.json({
      data: [...billRows, ...stockRows.filter((row) => !fromBill.has(row.isn))],
    });
  } catch (error) {
    console.error("serial search failed", error);
    return NextResponse.json({ error: "ຄົ້ນ ISN ບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
