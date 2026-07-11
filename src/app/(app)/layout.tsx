import { logoutAction } from "@/app/actions/auth";
import { myActivityCount } from "@/app/actions/chatter";
import { myNotificationCount } from "@/app/actions/notification";
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

  const [activities, notifications] = await Promise.all([myActivityCount(), myNotificationCount()]);

  return (
    <AppShell
      username={session.username}
      role={role}
      activities={activities}
      notifications={notifications}
      logout={logoutAction}
    >
      {children}
    </AppShell>
  );
}
