import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { roleOf, SERVICE_SIDE } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";

/**
 * **ພາລະງານຂອງຊ່າງແຕ່ລະຄົນ** — ໃຊ້ຕອນຈັດຊ່າງ (components/installation/assign-tech).
 *
 * ── ເປັນຫຍັງຕ້ອງມີ ──
 * modal ຈັດຊ່າງເປັນ dropdown ລາຍຊື່ລ້ວນ ⇒ ຜູ້ຈັດງານ **ບໍ່ຮູ້ວ່າຊ່າງຄົນນັ້ນມື້ນັ້ນຖືກນັດຢູ່ຈັກບ່ອນແລ້ວ**
 * ⇒ ນັດຊ້ອນກັນໄດ້ ແລະ ຮູ້ຕໍ່ເມື່ອຊ່າງໂທມາຟ້ອງ. ໜ້າ /installations/schedule ມີຂໍ້ມູນນີ້ຢູ່ແລ້ວ
 * ແຕ່ຢູ່ຄົນລະໜ້າກັບຕອນທີ່ຕັດສິນໃຈ.
 *
 * ສອງເລກທີ່ສົ່ງກັບ:
 *   day  — ງານທີ່ **ນັດໄວ້ໃນມື້ນັ້ນ** ທັງ ຕິດຕັ້ງ ແລະ ສ້ອມ (ຕົວກັນນັດຊ້ອນໂດຍກົງ)
 *          ຝັ່ງສ້ອມນັດວັນໄດ້ຕັ້ງແຕ່ migration 2026-07-13-repair-location (tb_product.appoint_date)
 *          — ກ່ອນນັ້ນນັບໄດ້ແຕ່ຝັ່ງຕິດຕັ້ງ ⇒ ຊ່າງຖືກນັດຊ້ອນຂ້າມສອງຝັ່ງໂດຍບໍ່ມີໃຜເຫັນ.
 *   open — ງານທີ່ **ຍັງຖືຢູ່ໃນມື** ທັງສອງຝັ່ງ (ຮວມທັງງານທີ່ບໍ່ໄດ້ນັດວັນ)
 *
 * ສິດ: matcher ຂອງ src/proxy.ts ຕັດ /api ອອກ ⇒ ກວດ role ເອງ (ຝ່າຍບໍລິການ — ຄືໜ້າຈັດຊ່າງ).
 */
export type TechLoad = {
  tech: string;
  /** ງານຕິດຕັ້ງທີ່ນັດໄວ້ໃນວັນທີ່ຖາມ */
  day: number;
  /** ງານທີ່ຍັງບໍ່ຈົບ ຢູ່ໃນມືຊ່າງ (ຕິດຕັ້ງ + ສ້ອມ) */
  open: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!SERVICE_SIDE.includes(roleOf(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("d") ?? "";
  const day = ISO.test(raw) ? raw : null;

  try {
    const rows = (
      await query<TechLoad>(
        `select t.tech,
            (coalesce(i.day, 0) + coalesce(r.day, 0))::int as day,
            (coalesce(i.open, 0) + coalesce(r.open, 0))::int as open
          from (
            -- ຊ່າງທຸກຄົນທີ່ມີງານໃນມື ຫຼື ຖືກນັດມື້ນັ້ນ (ຊື່ຊ່າງມາຈາກຕາຕະລາງງານ ບໍ່ແມ່ນຜູ້ໃຊ້
            -- ເພາະ modal ສະແດງລາຍຊື່ຊ່າງຈາກຝັ່ງ server ຢູ່ແລ້ວ — ບ່ອນນີ້ໃຫ້ພຽງຕົວເລກ)
            select distinct nullif(tech_code,'') as tech from ods_tb_install where tech_code is not null
            union
            select distinct nullif(emp_code,'') as tech from tb_product where emp_code is not null
          ) t
          left join (
            select nullif(tech_code,'') as tech,
                count(*) filter (where $1::date is not null and appoint_date = $1::date)::int as day,
                count(*)::int as open
              from ods_tb_install
             where cancel_date is null and job_finish is null and nullif(tech_code,'') is not null
             group by 1
          ) i on i.tech = t.tech
          left join (
            -- ງານສ້ອມທີ່ຊ່າງຖືຢູ່ ແລະ ທີ່ນັດໄວ້ໃນມື້ນັ້ນ (ດຽວນີ້ tb_product ມີ appoint_date ແລ້ວ)
            select nullif(emp_code,'') as tech,
                count(*)::int as open,
                count(*) filter (where $1::date is not null and appoint_date = $1::date)::int as day
              from tb_product
             where nullif(emp_code,'') is not null
               and time_finish_repair is null
               and cancel_start is null
             group by 1
          ) r on r.tech = t.tech
         where t.tech is not null`,
        [day],
      )
    ).rows;

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("tech load failed", error);
    return NextResponse.json({ error: "ດຶງພາລະງານຂອງຊ່າງບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
