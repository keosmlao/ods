import { getSession } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { roleOf, STOCK_SIDE, TECH_SIDE } from "@/lib/roles";
import { SETTING, settingEnabled } from "@/lib/settings";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ຄົ້ນຫາອາໄຫຼ່ — ຖອດແບບຈາກ ods get_data_spare() + /search_req_spare (tech_reg_install.py)
 *
 * ── ສິດ ──
 * matcher ຂອງ src/proxy.ts ຕັດ /api ອອກ ⇒ ຕ້ອງກວດ role ເອງຢູ່ນີ້.
 * ຜູ້ໃຊ້: ໜ້າຂໍເບີກຂອງຊ່າງ (+ ສາງ ທີ່ເບິ່ງລາຍການອາໄຫຼ່).
 */
export type SpareRow = {
  code: string;
  name_1: string;
  unit_code: string | null;
  balance_qty: number;
  standard_qty: number;
  requested_qty: number;
  issued_qty: number;
  remaining_qty: number;
};

const ALLOWED = [...TECH_SIDE, ...STOCK_SIDE];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(roleOf(session))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  /**
   * ຄົ້ນ ERP ເພື່ອ**ເພີ່ມລາຍການນອກມາດຕະຖານ** ⇒ ຢູ່ໃຕ້ສະວິດອັນດຽວກັບ addSpareLines.
   * ປິດແລ້ວຄືນລາຍການຫວ່າງ (ບໍ່ແມ່ນ 403) — ຟອມກອງລາຍການທີ່ມີຢູ່ຕໍ່ໄປໄດ້ຕາມປົກກະຕິ.
   *
   * ຍົກເວັ້ນ `scope=standard`: ນັ້ນຄືໜ້າ**ນິຍາມມາດຕະຖານເອງ** (/manage/install-standard,
   * ຜູ້ຈັດການ) — ຖ້າສະວິດປິດແລ້ວຄົ້ນບໍ່ໄດ້ ຈະກາຍເປັນ "ປິດແລ້ວແກ້ໃຫ້ດີຂຶ້ນບໍ່ໄດ້ອີກ".
   */
  const scope = request.nextUrl.searchParams.get("scope");
  const forStandard = scope === "standard" && roleOf(session) === "manager";
  if (!forStandard && !(await settingEnabled(SETTING.INSTALL_SPARE_FREE_SEARCH))) {
    return NextResponse.json({ data: [], disabled: true });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const job = (request.nextUrl.searchParams.get("job") ?? "").trim();
  try {
    const inventory = (
      await queryOdg<SpareRow>(
        `select code, name_1, unit_standard as unit_code, coalesce(balance_qty,0)::int as balance_qty
         from ic_inventory
         where code like $1 or name_1 like $1
         order by code
         limit 20`,
        [`%${q}%`],
      )
    ).rows;
    const progress = job && inventory.length
      ? (
          await query<{
            item_code: string;
            standard_qty: number;
            requested_qty: number;
            issued_qty: number;
          }>(
            `select item.item_code,
                coalesce((select sum(s.qty) from tb_used_spare s
                          where s.product_code=$1 and s.item_code=item.item_code),0)::float8 standard_qty,
                coalesce((select sum(case when d.trans_flag=122 then d.qty else -d.qty end)
                            from ic_trans_detail d
                           where d.product_code=$1 and d.item_code=item.item_code
                             and d.trans_flag in (122,59)),0)::float8 requested_qty,
                coalesce((select sum(d.qty) from ic_trans_detail d
                          where d.product_code=$1 and d.item_code=item.item_code
                            and d.trans_flag=56),0)::float8 issued_qty
               from unnest($2::text[]) item(item_code)`,
            [job, inventory.map((row) => row.code)],
          )
        ).rows
      : [];
    const byItem = new Map(progress.map((row) => [row.item_code, row]));
    const rows: SpareRow[] = inventory.map((row) => {
      const status = byItem.get(row.code);
      const standard = status?.standard_qty ?? 0;
      const requested = status?.requested_qty ?? 0;
      return {
        ...row,
        standard_qty: standard,
        requested_qty: requested,
        issued_qty: status?.issued_qty ?? 0,
        remaining_qty: Math.max(0, standard - requested),
      };
    });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("spare search failed", error);
    return NextResponse.json({ error: "ຄົ້ນຫາບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
