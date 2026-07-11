import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextResponse, type NextRequest } from "next/server";

/** ຄົ້ນຫາອາໄຫຼ່ — ຖອດແບບຈາກ ods get_data_spare() + /search_req_spare (tech_reg_install.py) */
export type SpareRow = { code: string; name_1: string; unit_code: string | null; balance_qty: number };

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  try {
    const rows = (
      await query<SpareRow>(
        `select code, name_1, unit_code, coalesce(balance_qty,0)::int as balance_qty
         from ic_inventory
         where code like $1 or name_1 like $1 or part_number like $1
         order by code
         limit 20`,
        [`%${q}%`],
      )
    ).rows;
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("spare search failed", error);
    return NextResponse.json({ error: "ຄົ້ນຫາບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
