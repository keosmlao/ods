import type { Workflow } from "@/lib/commission";
import {
  acceptInstall,
  checkIn,
  checkOut,
  finishInstallFlow,
  finishRepairFlow,
  rejectJob,
  startInstallFlow,
  startRepairFlow,
  type FlowResult,
} from "@/lib/job-flow";
import { MAX_PHOTO_CHARS, requireMobile } from "@/lib/mobile-auth";
import { TECH_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * ຄຳສັ່ງທັງໝົດຂອງຊ່າງຈາກແອັບ — ຜ່ານ route ດຽວ ດ້ວຍ `action` ໃນ body.
 *
 * ⚠️ ຕົວປ່ຽນຂັ້ນຢູ່ lib/job-flow ບ່ອນດຽວ (ໃຊ້ຮ່ວມກັບເວັບ) — route ນີ້ເປັນພຽງທາງເຂົ້າ.
 * ຢ່າຂຽນ SQL ປ່ຽນຂັ້ນຢູ່ນີ້ ບໍ່ດັ່ງນັ້ນແອັບຈະຂ້າມເງື່ອນໄຂຂັ້ນທີ່ເວັບກວດໄວ້.
 */
type Body = {
  action: "accept" | "reject" | "start" | "finish" | "checkin" | "checkout";
  reason?: string;
  note?: string;
  lat?: number;
  lng?: number;
  photo?: string;
};

export async function POST(request: Request, context: { params: Promise<{ workflow: string; code: string }> }) {
  const guard = await requireMobile(request, TECH_SIDE);
  if (!guard.ok) return guard.response;

  const { workflow: raw, code } = await context.params;
  if (raw !== "install" && raw !== "repair") {
    return NextResponse.json({ error: "ສາຍງານບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }
  const workflow = raw as Workflow;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  if (body.photo && body.photo.length > MAX_PHOTO_CHARS) {
    return NextResponse.json({ error: "ຮູບໃຫຍ່ເກີນໄປ — ກະລຸນາຖ່າຍໃໝ່" }, { status: 413 });
  }

  const user = guard.user;
  let result: FlowResult;

  try {
    switch (body.action) {
      case "accept":
        // ຝັ່ງສ້ອມບໍ່ມີຂັ້ນ "ຮັບງານ" — CS ມອບໝາຍແລ້ວຖືວ່າຮັບ (ຄືເວັບ)
        result =
          workflow === "install"
            ? await acceptInstall(user, code)
            : { ok: false, error: "ງານສ້ອມບໍ່ຕ້ອງກົດຮັບ — ເລີ່ມກວດເຊັກໄດ້ເລີຍ" };
        break;
      case "reject":
        result = await rejectJob(user, workflow, code, String(body.reason ?? ""));
        break;
      case "start":
        result = workflow === "install" ? await startInstallFlow(user, code) : await startRepairFlow(user, code);
        break;
      case "finish":
        result =
          workflow === "install"
            ? await finishInstallFlow(user, code)
            : await finishRepairFlow(user, code, String(body.note ?? ""));
        break;
      case "checkin":
        result = await checkIn(user, workflow, code, {
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          photo: body.photo ?? null,
          note: body.note ?? "",
        });
        break;
      case "checkout":
        result = await checkOut(user, workflow, code, {
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          note: body.note ?? "",
        });
        break;
      default:
        return NextResponse.json({ error: "ຄຳສັ່ງບໍ່ຖືກຕ້ອງ" }, { status: 400 });
    }
  } catch (error) {
    console.error("Mobile job action failed", error);
    return NextResponse.json({ error: "ດຳເນີນການບໍ່ສຳເລັດ" }, { status: 500 });
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // ໜ້າເວັບຕ້ອງເຫັນຜົນຂອງແອັບທັນທີ (ຄິວຂອງ CS · ສາງ · QC ອ່ານຈາກຖັນດຽວກັນ)
  for (const path of ["/dashboard", "/installations", "/installations/accept", "/installations/work", "/repair", "/qc"]) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, message: result.message });
}
