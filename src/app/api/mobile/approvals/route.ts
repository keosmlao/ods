import {
  approveCancellationCore,
  approveQuoteCore,
  rejectCancellationCore,
  rejectQuoteCore,
} from "@/lib/approval-core";
import { requireMobile } from "@/lib/mobile-auth";
import { pendingApprovals } from "@/lib/mobile-approvals";
import { APPROVER_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * ຄິວອະນຸມັດ — ສະເພາະຜູ້ຈັດການ/ຫົວໜ້າ (APPROVER_SIDE).
 *
 * GET  → ລາຍການທີ່ລໍອະນຸມັດ
 * POST → ອະນຸມັດ / ບໍ່ອະນຸມັດ (SQL ເງິນຢູ່ lib/approval-core ບ່ອນດຽວກັບເວັບ)
 *
 * ⚠️ core ຮັບ **username** ແລະ **ຖືວ່າຜ່ານສິດແລ້ວ** — ການກວດສິດ (APPROVER_SIDE) ຢູ່ນີ້.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request, APPROVER_SIDE);
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ items: await pendingApprovals() });
  } catch (error) {
    console.error("Mobile approvals failed", error);
    return NextResponse.json({ error: "ໂຫຼດຄິວອະນຸມັດບໍ່ສຳເລັດ" }, { status: 500 });
  }
}

type Body = {
  action: "approve_quote" | "reject_quote" | "approve_cancellation" | "reject_cancellation";
  /** ເລກໃບສະເໜີ (quote) ຫຼື ລະຫັດເຄື່ອງ (cancellation) */
  ref: string;
  /** ເຫດຜົນ — ບັງຄັບສະເພາະ reject (core ກວດເອງ) */
  reason?: string;
};

export async function POST(request: Request) {
  const guard = await requireMobile(request, APPROVER_SIDE);
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  const ref = String(body.ref ?? "").trim();
  const reason = String(body.reason ?? "");
  const me = guard.user.username;
  if (!ref) return NextResponse.json({ error: "ບໍ່ພົບເລກທີ່ອ້າງອີງ" }, { status: 400 });

  try {
    const result =
      body.action === "approve_quote"
        ? await approveQuoteCore(me, ref, reason)
        : body.action === "reject_quote"
          ? await rejectQuoteCore(me, ref, reason)
          : body.action === "approve_cancellation"
            ? await approveCancellationCore(me, ref)
            : body.action === "reject_cancellation"
              ? await rejectCancellationCore(me, ref, reason)
              : ({ ok: false, error: "ຄຳສັ່ງບໍ່ຖືກຕ້ອງ" } as const);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // ໜ້າເວັບ (ຄິວອະນຸມັດ · ໃບງານ) ຕ້ອງເຫັນຜົນທັນທີ
    for (const path of ["/approvals", "/quotations", "/service", "/dashboard"]) revalidatePath(path, "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mobile approval action failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
