import type { Metadata } from "next";
import { Noto_Sans_Lao } from "next/font/google";
import "./globals.css";

const font = Noto_Sans_Lao({ variable: "--font-lao", subsets: ["lao", "latin"] });
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
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lo">
      <body suppressHydrationWarning className={`${font.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
