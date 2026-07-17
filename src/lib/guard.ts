import { getSession, type Session } from "@/lib/auth";
import type { PermissionAction } from "@/lib/permission-catalog";
import { permissionFromOverrides, permissionOverrides } from "@/lib/permissions";
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

/**
 * ── ⚠️ ເປັນຫຍັງ requireRole ຈຶ່ງ**ບໍ່**ເບິ່ງສິດລາຍຄົນ (override) ──
 * ແຕ່ກ່ອນມີ `requestOverride()` ທີ່ເອົາ resource ມາຈາກ header **`Referer`** ແລ້ວ
 * ຖ້າຄົນນັ້ນມີ override read+update ຢູ່ resource ນັ້ນ ກໍ່**ຜ່ານໂດຍບໍ່ເບິ່ງ role ເລີຍ**.
 * ແຕ່ `Referer` ມາຈາກ browser ⇒ **ຜູ້ຮ້າຍຕັ້ງເອງໄດ້**: ຄົນທີ່ໄດ້ສິດແກ້ໜ້າດຽວ
 * (ເຊັ່ນ /customers) ຕັ້ງ `Referer: /customers` ແລ້ວຍິງ `approvePoOrder` ກໍ່ຜ່ານ.
 * ຄວາມຕ່າງກັບ `requirePermission` ຄື ບ່ອນນັ້ນ resource **ສົ່ງມາຈາກໂຄ້ດ** ບໍ່ແມ່ນຈາກ header.
 *
 * ⇒ ຕັດອອກ. ຢາກໃຫ້ສິດລາຍຄົນກັບ action ໃດ → ໃຊ້ `requirePermission(resource, …)`
 * ພ້ອມລະບຸ resource ຢູ່ບ່ອນເອີ້ນ. (ຕອນຕັດ ຕາຕະລາງ ods_user_menu_permission ຫວ່າງ
 * ທັງໝົດ 0 ແຖວ ⇒ ບໍ່ມີໃຜເສຍສິດທີ່ເຄີຍໃຊ້ຢູ່)
 */

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

/**
 * ດ່ານ CRUD ລາຍເມນູ:
 * - ມີ override ຂອງ user -> ໃຊ້ C/R/U/D ທີ່ manager ກຳນົດ
 * - ບໍ່ມີ override -> ຮັກສາ allowed roles ຂອງ action ເກົ່າ
 */
export async function requirePermission(
  resource: string,
  action: PermissionAction,
  fallbackRoles: readonly Role[],
  denied: string = NO_RIGHT,
): Promise<Guard> {
  const session = await getSession();
  if (!session) return { ok: false, error: NO_SESSION };

  const overrides = await permissionOverrides(session.username);
  const assigned = overrides.has(resource);
  const allowed = assigned
    ? permissionFromOverrides(session, resource, overrides).read && permissionFromOverrides(session, resource, overrides)[action]
    : fallbackRoles.includes(roleOf(session));
  return allowed ? { ok: true, session } : { ok: false, error: denied };
}

export async function requirePermissionOrRedirect(
  resource: string,
  action: PermissionAction,
  fallbackRoles: readonly Role[],
): Promise<Session> {
  const guard = await requirePermission(resource, action, fallbackRoles);
  if (!guard.ok) redirect(guard.error === NO_SESSION ? "/login" : "/forbidden");
  return guard.session;
}
