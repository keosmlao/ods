import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * ເມືອງຕາມແຂວງ — ຖອດແບບຈາກ sel_city() ໃນ ods/getJson.py (`/sel_city/<id>`)
 * ໃຊ້ໂດຍ dropdown ແຂວງ→ເມືອງ ຂອງຟອມລູກຄ້າ
 */
export async function GET(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json([], { status: 401 });

  const province = req.nextUrl.searchParams.get("province")?.trim() ?? "";
  if (!province) return NextResponse.json([]);

  const r = await query<{ code: string; name_1: string }>(
    "select code, name_1 from city where province = $1 order by roworder asc",
    [province],
  );
  return NextResponse.json(r.rows);
}
