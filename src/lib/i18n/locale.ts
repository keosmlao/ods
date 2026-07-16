import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * ອ່ານພາສາປັດຈຸບັນຈາກ cookie (ຝັ່ງ server).
 * ບໍ່ມີ / ຄ່າຜິດ ⇒ ຄືນ DEFAULT_LOCALE (ລາວ). ໃຊ້ໃນ layout ແລະ page.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
