"use server";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

/**
 * ປ່ຽນພາສາ — ຂຽນ cookie ແລ້ວ revalidate ທັງ tree ໃຫ້ Server Component render ຄືນ
 * ດ້ວຍ dictionary ໃໝ່. ບໍ່ redirect ⇒ ຢູ່ໜ້າເດີມ, URL ຄືເກົ່າ (RBAC ບໍ່ກະທົບ).
 */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 ປີ
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
