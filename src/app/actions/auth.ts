"use server";
import { clearSession, createSession } from "@/lib/auth";
import { verifyCredentials } from "@/lib/credentials";
import { recordLogin } from "@/lib/login-log";
import { homeForRole, roleOf } from "@/lib/roles";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** IP ຈິງຈາກ header ຂອງ proxy (x-forwarded-for ອາດມີຫຼາຍຄ່າ — ເອົາຄ່າທຳອິດ) */
async function requestIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

type LoginState = { error?: string };

/**
 * ໜ້າ login ຂອງເວັບ.
 * ກົດເກນການກວດຕົວຕົນທັງໝົດຢູ່ lib/credentials ບ່ອນດຽວ — **ໃຊ້ຮ່ວມກັບແອັບມືຖື**
 * (/api/mobile/login) ຈຶ່ງບໍ່ມີທາງທີ່ສອງທາງເຂົ້າຈະມີກົດເກນຕ່າງກັນ.
 */
export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    const result = await verifyCredentials(username, password);
    if (!result.ok) return { error: result.error };
    await createSession(result.session);
    const h = await headers();
    await recordLogin(result.session.username, "web", await requestIp(), h.get("user-agent"));
    redirect(homeForRole(roleOf(result.session)));
  } catch (error) {
    // redirect() ຂອງ Next ໂຍນ error ພິເສດອອກມາ — ຕ້ອງປ່ອຍຜ່ານ ບໍ່ແມ່ນຈັບໄວ້
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("Login failed", error);
    return { error: "ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນໄດ້" };
  }
  return {};
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
