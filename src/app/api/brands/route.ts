import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/** ຄື /showbrand ຂອງ ods */
export async function GET() {
  if (!(await getSession())) return NextResponse.json([], { status: 401 });
  const r = await query<{ code: string; name_1: string }>("select code,name_1 from tb_brand order by code");
  return NextResponse.json(r.rows);
}

/** ຄື /save_newbrand ຂອງ ods — tb_brand.code = tb_brand.name_1 */
export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { name_1?: unknown } | null;
  const name = typeof body?.name_1 === "string" ? body.name_1.trim() : "";
  if (!name) return NextResponse.json({ error: "ກະລຸນາປ້ອນຊື່ຫຍີ່ຫໍ້" }, { status: 400 });

  const exists = await query<{ code: string }>("select code from tb_brand where lower(code)=lower($1) limit 1", [name]);
  if (exists.rows[0]) return NextResponse.json({ code: exists.rows[0].code, existed: true });

  await query("insert into tb_brand(code,name_1) values($1,$1)", [name]);
  return NextResponse.json({ code: name, existed: false }, { status: 201 });
}
