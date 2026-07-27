import type { Workflow } from "@/lib/commission";
import { ownMobileJob } from "@/lib/job-flow";
import { requireMobile } from "@/lib/mobile-auth";
import { completeJobActivity, jobChatter, postJobMessage, scheduleOwnJobActivity } from "@/lib/mobile-chatter";
import { TECH_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Chatter ແລະ ກິດຈະກຳ ຂອງງານ ສຳລັບແອັບຊ່າງ.
 *
 * GET  → ຂໍ້ຄວາມ (ຄົນພິມ + log ຂອງລະບົບ) ແລະ ກິດຈະກຳທີ່ຍັງຄ້າງ
 * POST → ພິມຂໍ້ຄວາມ ຫຼື ປິດກິດຈະກຳ
 *
 * ຂໍ້ຄວາມທີ່ພິມຈາກແອັບ ເຂົ້າ ods_chatter_message ອັນດຽວກັບເວັບ ⇒ CS ເຫັນຢູ່ໜ້າໃບງານ
 * ແລະ ໄດ້ຮັບແຈ້ງເຕືອນທັນທີ (notify → pg_notify).
 */

function parseWorkflow(raw: string): Workflow | null {
  return raw === "install" || raw === "repair" ? (raw as Workflow) : null;
}

export async function GET(request: Request, context: { params: Promise<{ workflow: string; code: string }> }) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const { workflow: raw, code } = await context.params;
  const workflow = parseWorkflow(raw);
  if (!workflow) return NextResponse.json({ error: "ສາຍງານບໍ່ຖືກຕ້ອງ" }, { status: 400 });

  const own = await ownMobileJob(guard.user, workflow, code);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });

  try {
    return NextResponse.json(await jobChatter(workflow, code));
  } catch (error) {
    console.error("Mobile chatter load failed", error);
    return NextResponse.json({ error: "ໂຫຼດການເຄື່ອນໄຫວບໍ່ສຳເລັດ" }, { status: 500 });
  }
}

type Body =
  | { action: "post"; body: string }
  | { action: "complete_activity"; id: number; note?: string }
  | { action: "schedule_activity"; kind: string; summary: string; note?: string; due_date: string };

export async function POST(request: Request, context: { params: Promise<{ workflow: string; code: string }> }) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const { workflow: raw, code } = await context.params;
  const workflow = parseWorkflow(raw);
  if (!workflow) return NextResponse.json({ error: "ສາຍງານບໍ່ຖືກຕ້ອງ" }, { status: 400 });

  const own = await ownMobileJob(guard.user, workflow, code);
  if (!own.ok) return NextResponse.json({ error: own.error }, { status: 403 });

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  try {
    const result =
      body.action === "post"
        ? await postJobMessage(workflow, code, guard.user.username, String(body.body ?? ""))
        : body.action === "complete_activity"
          ? await completeJobActivity(Number(body.id), guard.user.username, String(body.note ?? ""))
          : body.action === "schedule_activity"
            ? await scheduleOwnJobActivity(workflow, code, guard.user.username, {
                kind: String(body.kind ?? "todo"),
                summary: String(body.summary ?? ""),
                note: String(body.note ?? ""),
                dueDate: String(body.due_date ?? ""),
              })
          : ({ ok: false, error: "ຄຳສັ່ງບໍ່ຖືກຕ້ອງ" } as const);

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // ໜ້າເວັບຕ້ອງເຫັນຂໍ້ຄວາມຂອງຊ່າງທັນທີ
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mobile chatter action failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
