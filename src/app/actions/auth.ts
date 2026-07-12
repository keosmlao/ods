"use server";
import { clearSession, createSession } from "@/lib/auth";
import { verifyCredentials } from "@/lib/credentials";
import { redirect } from "next/navigation";

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
    redirect("/dashboard");
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
