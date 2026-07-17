import { getSession } from "@/lib/auth";
import { homeForRole, roleOf } from "@/lib/roles";
import { redirect } from "next/navigation";
export default async function Home() {
  const session = await getSession();
  redirect(session ? homeForRole(roleOf(session)) : "/login");
}
