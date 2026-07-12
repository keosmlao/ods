"use server";
import { getSession } from "@/lib/auth";
import type { Workflow } from "@/lib/commission";
import { canQcJob, qcChecklistFor, qcWorkflowsFor, saveQcFlow, type QcAnswer, type QcItem } from "@/lib/qc-flow";
import { roleOf } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * ດ່ານກວດຮັບຄຸນນະພາບ — ຝັ່ງ **ເວັບ**.
 * ກົດເກນທັງໝົດຢູ່ lib/qc-flow ບ່ອນດຽວ (ຄົນເຮັດກວດເອງບໍ່ໄດ້ · ຜູ້ຈັດການກຳນົດຜູ້ກວດ ·
 * ຕົກ QC = ສົ່ງກັບໃຫ້ຊ່າງ) — **ອັນດຽວກັບທີ່ແອັບມືຖືເອີ້ນ** (/api/mobile/qc).
 */
export type QcState = { error?: string; ok?: string };
// ໝາຍເຫດ: ໄຟລ໌ "use server" **export type ຕໍ່ບໍ່ໄດ້** (Turbopack ຫາ export ຈິງບໍ່ພົບ)
// ⇒ ໜ້າຕ່າງໆ import ຊະນິດຈາກ lib/qc-flow ໂດຍກົງ

/** ໃຊ້ຢູ່ໜ້າ — ຜູ້ນີ້ກົດປຸ່ມ QC ໄດ້ບໍ (ບໍ່ໂຍນ error) */
export async function canQc(workflow: Workflow, jobCode: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return (await canQcJob(session, workflow, jobCode)).ok;
}

/**
 * ສາຍງານທີ່ role ຂອງຜູ້ນີ້ກວດໄດ້ — ອ່ານຈາກ ods_qc_role (ຜູ້ຈັດການກຳນົດ).
 *
 * ໜ້າ /qc ເປີດໃຫ້ທຸກ role ໃນຕາຕະລາງສິດ (lib/roles) ໂດຍເຈດຕະນາ ເພາະ "ໃຜກວດໄດ້"
 * ຢູ່ໃນຖານຂໍ້ມູນ ບໍ່ແມ່ນຢູ່ໃນໂຄດ ⇒ ດ່ານຈິງແມ່ນອັນນີ້ (ໜ້າພາໄປ /forbidden ຖ້າຫວ່າງ).
 */
export async function qcWorkflows(): Promise<Workflow[]> {
  const session = await getSession();
  if (!session) return [];
  return qcWorkflowsFor(roleOf(session));
}

export async function qcChecklist(workflow: Workflow, jobCode: string): Promise<QcItem[]> {
  return qcChecklistFor(workflow, jobCode);
}

const saveSchema = z.object({
  workflow: z.enum(["repair", "install"]),
  job_code: z.string().min(1),
  signer_name: z.string(),
  signer_tel: z.string(),
  signature: z.string(),
});

export async function saveQc(_: QcState, formData: FormData): Promise<QcState> {
  const session = await getSession();
  if (!session) return { error: "Session ໝົດອາຍຸ" };

  const parsed = saveSchema.safeParse({
    workflow: formData.get("workflow"),
    job_code: formData.get("job_code"),
    signer_name: formData.get("signer_name") ?? "",
    signer_tel: formData.get("signer_tel") ?? "",
    signature: formData.get("signature") ?? "",
  });
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  // ຄຳຕອບມາເປັນ JSON ກ້ອນດຽວ (ຮູບ base64 ຍາວ ⇒ ໃສ່ field ແຍກແລ້ວອ່ານຍາກ)
  let answers: QcAnswer[];
  try {
    answers = JSON.parse(String(formData.get("answers") ?? "[]"));
  } catch {
    return { error: "ຂໍ້ມູນຜົນກວດບໍ່ຖືກຕ້ອງ" };
  }

  const result = await saveQcFlow(session, {
    workflow: parsed.data.workflow,
    jobCode: parsed.data.job_code,
    answers,
    signer_name: parsed.data.signer_name,
    signer_tel: parsed.data.signer_tel,
    signature: parsed.data.signature,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/qc/${parsed.data.workflow}/${parsed.data.job_code}`);
  revalidatePath("/qc");
  revalidatePath("/dashboard");
  return { ok: result.message };
}
