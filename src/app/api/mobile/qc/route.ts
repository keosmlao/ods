import type { Workflow } from "@/lib/commission";
import { jobPhotos } from "@/lib/job-flow";
import { requireMobile } from "@/lib/mobile-auth";
import { qcChecklistFor, qcWorkflowsFor, saveQcFlow, type QcAnswer } from "@/lib/qc-flow";
import { qcQueue } from "@/lib/qc";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * ກວດຮັບຄຸນນະພາບ ຈາກມືຖື — ຫົວໜ້າຊ່າງກວດຢູ່ໜ້າງານໄດ້ເລີຍ (ຖ່າຍຮູບຈາກກ້ອງ).
 *
 * **ໃຜກວດໄດ້ຢູ່ໃນຖານຂໍ້ມູນ** (ods_qc_role — ຜູ້ຈັດການກຳນົດ) ບໍ່ແມ່ນຢູ່ໃນໂຄດ
 * ⇒ ບໍ່ຈຳກັດ role ຢູ່ດ່ານ API ແຕ່ໃຫ້ lib/qc-flow ຕັດສິນ (ຄືກັບໜ້າ /qc ຂອງເວັບ).
 * ຄົນເຮັດງານ **ກວດງານຂອງຕົນເອງບໍ່ໄດ້** ສະເໝີ.
 */
export async function GET(request: Request) {
  const guard = await requireMobile(request);
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  const workflows = await qcWorkflowsFor(roleOf(guard.user));
  if (workflows.length === 0) return NextResponse.json({ error: "ບໍ່ມີສິດກວດຮັບຄຸນນະພາບ" }, { status: 403 });

  const workflow = params.get("workflow") as Workflow | null;
  const code = params.get("code");

  try {
    // ລາຍລະອຽດງານດຽວ (checklist + ຮູບຜົນງານທີ່ຊ່າງຖ່າຍໄວ້)
    if (workflow && code) {
      if (!workflows.includes(workflow)) return NextResponse.json({ error: "ບໍ່ມີສິດ" }, { status: 403 });
      const [items, photos] = await Promise.all([qcChecklistFor(workflow, code), jobPhotos(workflow, code)]);
      return NextResponse.json({ items, photos });
    }

    // ຄິວ QC ຂອງທຸກສາຍງານທີ່ຜູ້ນີ້ກວດໄດ້
    const queues = await Promise.all(
      workflows.map(async (flow) => (await qcQueue(flow)).map((row) => ({ ...row, workflow: flow }))),
    );
    return NextResponse.json({ jobs: queues.flat() });
  } catch (error) {
    console.error("Mobile QC failed", error);
    return NextResponse.json({ error: "ໂຫຼດຄິວ QC ບໍ່ສຳເລັດ" }, { status: 500 });
  }
}

type Body = {
  workflow: Workflow;
  code: string;
  answers: QcAnswer[];
  signer_name?: string;
  signer_tel?: string;
  signature?: string;
};

export async function POST(request: Request) {
  const guard = await requireMobile(request);
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  try {
    const result = await saveQcFlow(guard.user, {
      workflow: body.workflow,
      jobCode: String(body.code ?? ""),
      answers: body.answers ?? [],
      signer_name: String(body.signer_name ?? ""),
      signer_tel: String(body.signer_tel ?? ""),
      signature: String(body.signature ?? ""),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    for (const path of ["/qc", "/dashboard", "/returns", "/installations/close"]) revalidatePath(path);
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Mobile QC save failed", error);
    return NextResponse.json({ error: "ບັນທຶກບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
