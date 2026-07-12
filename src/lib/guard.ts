import { getSession, type Session } from "@/lib/auth";
import { type Role, roleOf } from "@/lib/roles";
import { redirect } from "next/navigation";

/**
 * ດ່ານກວດສິດຂອງ **server action** — ຄົນລະຊັ້ນກັບດ່ານກວດ "ໜ້າ".
 *
 * src/proxy.ts ກັນສະເພາະ **ເສັ້ນທາງຂອງໜ້າ** ເທົ່ານັ້ນ. Server action ຂອງ Next
 * ເປັນ POST ໄປຫາ URL ຂອງໜ້າທີ່ຜູ້ໃຊ້ຢືນຢູ່ ⇒ proxy ເຫັນແຕ່ວ່າ "ຄົນນີ້ເປີດໜ້ານີ້ໄດ້"
 * ບໍ່ໄດ້ເຫັນວ່າ action ທີ່ຖືກຍິງນັ້ນເຮັດຫຍັງ. ຊ່າງທີ່ຢືນຢູ່ /installations/work
 * ຈຶ່ງຍິງ action ຂອງສາງ (saveDispatch — ຕັດສະຕັອກ ERP) ໄດ້ ຖ້າ action ບໍ່ກວດເອງ.
 *
 * ⇒ ທຸກ action ທີ່ຂຽນຂໍ້ມູນ ຕ້ອງກວດສິດຢູ່ບ່ອນນີ້ອີກຊັ້ນ.
 * (ຄຳເຕືອນອັນນີ້ມີຢູ່ໃນ actions/quotation.ts ມາແຕ່ດົນແລ້ວ — ບ່ອນນີ້ຍົກຂຶ້ນເປັນຂອງກາງ)
 */

export type Guard = { ok: true; session: Session } | { ok: false; error: string };

export const NO_SESSION = "Session ໝົດອາຍຸ";
export const NO_RIGHT = "ບໍ່ມີສິດເຮັດລາຍການນີ້";

/** ສຳລັບ action ທີ່ຄືນ `{ error }` — ຜູ້ໃຊ້ເຫັນເຫດຜົນ */
export async function requireRole(allowed: readonly Role[], denied: string = NO_RIGHT): Promise<Guard> {
  const session = await getSession();
  if (!session) return { ok: false, error: NO_SESSION };
  if (!allowed.includes(roleOf(session))) return { ok: false, error: denied };
  return { ok: true, session };
}

/**
 * ສຳລັບ action ທີ່ຄືນ `void` (ບໍ່ມີບ່ອນສະແດງ error) — ບໍ່ມີສິດ → ພາໄປໜ້າ "ບໍ່ມີສິດເຂົ້າເຖິງ".
 * ບໍ່ໃຫ້ "ງຽບໆແລ້ວບໍ່ເກີດຫຍັງ" ຄືເກົ່າ ເພາະຜູ້ໃຊ້ຈະເຂົ້າໃຈວ່າສຳເລັດແລ້ວ.
 */
export async function requireRoleOrRedirect(allowed: readonly Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!allowed.includes(roleOf(session))) redirect("/forbidden");
  return session;
}
