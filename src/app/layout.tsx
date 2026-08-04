import { getLocale } from "@/lib/i18n/locale";
import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const font = localFont({
  src: "../../mobile/assets/fonts/NotoSansLao.ttf",
  variable: "--font-lao",
  display: "swap",
});

/**
 * ຟອນລາຕິນຕາມ Brand Guideline (ໜ້າ 7) — ໃຊ້ກັບຕົວອັກສອນ A–Z ແລະ ຕົວເລກ.
 *
 * Montserrat ບໍ່ມີ glyph ພາສາລາວ ⇒ browser ຈະຕົກໄປໃຊ້ --font-lao ໃຫ້ຕົວອັກສອນລາວ
 * ໂດຍອັດຕະໂນມັດ (fallback ເປັນລາຍ glyph ບໍ່ແມ່ນລາຍ element) ຈຶ່ງບໍ່ຕ້ອງແຍກ class.
 * ລຳດັບໃນ font-family ຂອງ globals.css ຈຶ່ງຕ້ອງເປັນ latin ກ່ອນ lao ສະເໝີ.
 *
 * ໝາຍເຫດ: guideline ກຳນົດ BoonHome ສຳລັບພາສາລາວ ແຕ່ຍັງບໍ່ມີໄຟລ໌ຟອນ —
 * ເມື່ອໄດ້ມາແລ້ວປ່ຽນສະເພາະ src ຂອງ localFont ຂ້າງເທິງ.
 */
const latin = Montserrat({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});
export const metadata: Metadata = { title: "ODIEN Service", description: "ລະບົບບໍລິການ ODS" };

/**
 * suppressHydrationWarning ຢູ່ <body> ເທົ່ານັ້ນ — **ບໍ່ແມ່ນການປິດການກວດ hydration**.
 *
 * ສ່ວນຂະຫຍາຍຂອງ browser (password manager, Grammarly, ad-blocker …) ມັກຕື່ມ attribute
 * ໃສ່ <body> ຫຼັງ HTML ຈາກ server ມາຮອດ ແຕ່ກ່ອນ React hydrate (ເຊັ່ນ
 * `__processed_<uuid>__="true"`) ⇒ React ຮ້ອງວ່າ server/client ບໍ່ຕົງກັນ ທັງທີ່ໂຄດເຮົາຖືກ.
 * ທຸງນີ້ບອກໃຫ້ຂ້າມຄວາມຕ່າງຂອງ **attribute ຢູ່ tag ນີ້ tag ດຽວ** — ຄວາມຕ່າງຂອງເນື້ອຫາ
 * ຂ້າງໃນ (ຄືບັກຈິງ) ຍັງຖືກລາຍງານຄືເກົ່າ.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body suppressHydrationWarning className={`${font.variable} ${latin.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
