import { query } from "@/lib/db";
import { requireMobile } from "@/lib/mobile-auth";
import { APPROVER_SIDE, STOCK_SIDE } from "@/lib/roles";
import { SETTING, settingEnabled } from "@/lib/settings";
import { inScopeCodes, inScopeRepairJobs } from "@/lib/stock-count";
import { STAGE_SQL } from "@/lib/stage";
import { NextResponse } from "next/server";

/**
 * **ກວດນັບສະຕ໋ອກເຄື່ອງສ້ອມ — ຝັ່ງແອັບມືຖື (Flutter)**
 *
 * GET  → ລາຍການເຄື່ອງທີ່ຕ້ອງນັບ (ຢູ່ສູນ · ຂ້າມ IH — ເບິ່ງ lib/stock-count)
 * POST → ສົ່ງ code ທີ່ສະແກນພົບ; server ໝາຍ 'ຕ້ອງກວດ' ໃຫ້ອັນທີ່ບໍ່ພົບ
 *
 * ⚠️ ແອັບໃຊ້ Bearer token (ບໍ່ແມ່ນ cookie) ⇒ ໃຊ້ holdJob (ທີ່ອ່ານ cookie) ບໍ່ໄດ້.
 * ຈຶ່ງ insert ເຂົ້າ ods_job_hold ໂດຍກົງ ດ້ວຍ **schema ອັນດຽວກັບ holdJob** (on conflict do nothing).
 */

/** ໃຜກວດນັບໄດ້ — ຫົວໜ້າ/ຜູ້ຈັດການ (APPROVER) + ພະນັກງານສາງ (STOCK) */
const COUNT_ROLES = Array.from(new Set([...APPROVER_SIDE, ...STOCK_SIDE]));

export async function GET(request: Request) {
  const guard = await requireMobile(request, COUNT_ROLES);
  if (!guard.ok) return guard.response;
  try {
    const jobs = await inScopeRepairJobs();
    return NextResponse.json({ jobs, enabled: await settingEnabled(SETTING.JOB_HOLD) });
  } catch (error) {
    console.error("Mobile stock-count list failed", error);
    return NextResponse.json({ error: "ໂຫຼດລາຍການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireMobile(request, COUNT_ROLES);
  if (!guard.ok) return guard.response;

  if (!(await settingEnabled(SETTING.JOB_HOLD))) {
    return NextResponse.json({ error: "ຄວາມສາມາດ ໝາຍວຽກມີບັນຫາ ຖືກປິດຢູ່" }, { status: 409 });
  }

  let body: { scanned?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }
  const scannedSet = new Set(
    (Array.isArray(body.scanned) ? body.scanned : []).map((code) => String(code).trim()).filter(Boolean),
  );

  try {
    const missing = (await inScopeCodes()).filter((code) => !scannedSet.has(code));
    let held = 0;
    for (const code of missing) {
      // ຂັ້ນປັດຈຸບັນ (ເກັບໄວ້ເບິ່ງຍ້ອນຫຼັງ ຄືກັບ holdJob) — ງານທີ່ສົ່ງຄືນແລ້ວຂ້າມ
      const job = (
        await query<{ stage: number }>(
          `select (${STAGE_SQL}) stage from tb_product a where a.code = $1 and a.return_complete is null`,
          [code],
        )
      ).rows[0];
      if (!job) continue;
      const done = await query(
        `insert into ods_job_hold(workflow, job_code, kind, reason, stage_at, created_by)
         values('repair', $1, 'other', $2, $3, $4)
         on conflict do nothing`,
        [code, "ກວດນັບສະຕ໋ອກ: ບໍ່ພົບຕົວ (ບໍ່ຖືກສະແກນ)", job.stage, guard.user.username],
      );
      if (done.rowCount) held += 1;
    }
    return NextResponse.json({ held, missing: missing.length });
  } catch (error) {
    console.error("Mobile stock-count finalize failed", error);
    return NextResponse.json({ error: "ບັນທຶກບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
