import { query } from "@/lib/db";
import { requireMobile } from "@/lib/mobile-auth";
import { EVERYONE } from "@/lib/roles";
import { countedCodes, inScopeRepairJobs } from "@/lib/stock-count";
import { NextResponse } from "next/server";

/**
 * **ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ — ຝັ່ງແອັບມືຖື (Flutter)**
 *
 * GET  → ລາຍການ pending ທັງໝົດ (jobs) + ລາຍການ job_code ທີ່ **ນັບແລ້ວ** (counted)
 * POST → ໝາຍ code ທີ່ສະແກນພົບເປັນ "ນັບແລ້ວ" (upsert ໃສ່ ods_stock_count)
 *
 * ⚠️ ແອັບໃຊ້ Bearer token (ບໍ່ແມ່ນ cookie) ⇒ ໃຊ້ server action markCounted (ອ່ານ cookie) ບໍ່ໄດ້,
 * ຈຶ່ງ insert ເຂົ້າ ods_stock_count ໂດຍກົງ (schema ດຽວກັບ web action). ບໍ່ auto-flag ຕ້ອງກວດ.
 */

/** ໃຜກວດນັບໄດ້ — ທຸກ role ທີ່ **ບໍ່ແມ່ນຊ່າງພາກສະໜາມ** (ຊ່າງໄປໜ້າຄິວວຽກຕົນ) */
const COUNT_ROLES = EVERYONE.filter((r) => r !== "technical" && r !== "headtechnical");

export async function GET(request: Request) {
  const guard = await requireMobile(request, COUNT_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const [jobs, counted] = await Promise.all([inScopeRepairJobs(), countedCodes()]);
    return NextResponse.json({ jobs, counted });
  } catch (error) {
    console.error("Mobile stock-count list failed", error);
    return NextResponse.json({ error: "ໂຫຼດລາຍການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireMobile(request, COUNT_ROLES);
  if (!guard.ok) return guard.response;

  let body: { scanned?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }
  const codes = [
    ...new Set((Array.isArray(body.scanned) ? body.scanned : []).map((code) => String(code).trim()).filter(Boolean)),
  ];

  try {
    for (const code of codes) {
      await query(
        `insert into ods_stock_count (job_code, counted_at, counted_by)
           values ($1, now(), $2)
         on conflict (job_code) do update set counted_at = now(), counted_by = excluded.counted_by`,
        [code, guard.user.username],
      );
    }
    return NextResponse.json({ counted: codes.length });
  } catch (error) {
    console.error("Mobile stock-count mark failed", error);
    return NextResponse.json({ error: "ບັນທຶກບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
