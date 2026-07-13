import { logoutAction } from "@/app/actions/auth";
import { myActivityCount } from "@/app/actions/chatter";
import { myNotificationCount } from "@/app/actions/notification";
import { qcWorkflows } from "@/app/actions/qc";
import { navCounts } from "@/lib/nav-counts";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { canAccess, roleOf } from "@/lib/roles";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * ດ່ານກວດ 2 ຊັ້ນ:
 *   1. ຍັງບໍ່ login → ໄປໜ້າ login
 *   2. login ແລ້ວ ແຕ່ບໍ່ມີສິດເປີດເສັ້ນທາງນີ້ → ໄປໜ້າ "ບໍ່ມີສິດເຂົ້າເຖິງ"
 *
 * ຊັ້ນ 2 ນີ້ເປັນການກວດຊ້ຳ — ດ່ານຫຼັກຢູ່ src/proxy.ts ເພາະ layout ບໍ່ render ຄືນ
 * ຕອນປ່ຽນໜ້າຝັ່ງ client ຈຶ່ງເຊື່ອຖືເປັນດ່ານດຽວບໍ່ໄດ້. proxy ຝາກ pathname ມາທາງ header.
 *
 * ໜ້າສາທາລະນະ (/track, /servicefuond, /tracking, /feedback, /pr-view, /login)
 * ຢູ່ນອກກຸ່ມ (app) ຈຶ່ງບໍ່ຜ່ານດ່ານນີ້.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = roleOf(session);
  const pathname = (await headers()).get("x-pathname");
  if (pathname && !canAccess(role, pathname)) redirect(`/forbidden?from=${encodeURIComponent(pathname)}`);

  /**
   * ເມນູ "ຄິວກວດຮັບຄຸນນະພາບ" ຂຶ້ນກັບ ods_qc_role (ຜູ້ຈັດການກຳນົດ) ບໍ່ແມ່ນ role ລ້ວນໆ
   * ⇒ ຄິດຢູ່ນີ້ບ່ອນດຽວ ແລ້ວສົ່ງລົງໄປໃຫ້ເມນູ (lib/navigation NavFlags).
   */
  const [activities, notifications, qc, counts] = await Promise.all([
    myActivityCount(),
    myNotificationCount(),
    qcWorkflows(),
    navCounts(session), // ຕົວເລກຄິວຂ້າງເມນູ — ລົ້ມກໍ່ຄືນ {} (ເມນູຍັງໃຊ້ໄດ້)
  ]);

  return (
    <AppShell
      username={session.username}
      role={role}
      navFlags={{ qc: qc.length > 0 }}
      counts={counts}
      activities={activities}
      notifications={notifications}
      logout={logoutAction}
    >
      {children}
    </AppShell>
  );
}
