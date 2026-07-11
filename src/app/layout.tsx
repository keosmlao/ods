import type { Metadata } from "next";
import { Noto_Sans_Lao } from "next/font/google";
import "./globals.css";

const font = Noto_Sans_Lao({ variable: "--font-lao", subsets: ["lao", "latin"] });
export const metadata: Metadata = { title: "ODIEN Service", description: "ລະບົບບໍລິການ ODS" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="lo"><body className={`${font.variable} antialiased`}>{children}</body></html>;
}
