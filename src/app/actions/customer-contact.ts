"use server";
import { logChange } from "@/lib/chatter-log";
import { CONTACT_MODEL, contactMark, type ContactKind } from "@/lib/customer-contact";
import { requireRole } from "@/lib/guard";
import { SERVICE_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ບັນທຶກວ່າ "ແຈ້ງລູກຄ້າແລ້ວ" — ເປັນຂໍ້ຄວາມ chatter ຂອງໃບນັ້ນ.
 *
 * ບໍ່ແມ່ນການສົ່ງຂໍ້ຄວາມ (ລະບົບບໍ່ມີຊ່ອງທາງສົ່ງ — LINE Notify ປິດແລ້ວ, ບໍ່ມີ SMS gateway)
 * ແຕ່ເປັນ **ຫຼັກຖານວ່າໃຜໂທ ເມື່ອໃດ ແລະ ລູກຄ້າຕອບຫຍັງ** ⇒ ໃບທີ່ລໍລູກຄ້າຢູ່ 200 ມື້
 * ຈະບໍ່ຖືກຖາມອີກວ່າ "ໂທໄປແລ້ວບໍ".
 *
 * ຝ່າຍບໍລິການ (CS + ຜູ້ຈັດການ) ເປັນຜູ້ຕິດຕໍ່ລູກຄ້າ — ຄືເກົ່າ.
 * (ອາໄຫຼ່ເທົ່ານັ້ນທີ່ບໍ່ຜ່ານ CS ຕາມນະໂຍບາຍ — ການສື່ສານກັບລູກຄ້າຍັງແມ່ນ CS)
 */
export type ContactState = { error?: string; ok?: string };

export async function markContacted(
  kind: ContactKind,
  code: string,
  note: string,
): Promise<ContactState> {
  const guard = await requireRole(SERVICE_SIDE, "ພະນັກງານບໍລິການເທົ່ານັ້ນທີ່ບັນທຶກການແຈ້ງລູກຄ້າໄດ້");
  if (!guard.ok) return { error: guard.error };

  const clean = note.trim().slice(0, 500);
  await logChange(
    CONTACT_MODEL[kind],
    code,
    `${contactMark(kind)}${clean ? ` — ${clean}` : ""}`,
  );

  revalidatePath("/customer-contact");
  return { ok: "ບັນທຶກການແຈ້ງແລ້ວ" };
}
