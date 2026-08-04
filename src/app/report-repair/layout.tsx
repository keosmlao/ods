import { DictProvider } from "@/lib/i18n/context";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * ໜ້າແຈ້ງສ້ອມສາທາລະນະ — ຢູ່ນອກກຸ່ມ (app) ຈຶ່ງ **ບໍ່ຜ່ານ** ການກວດ session
 * (ບໍ່ຕ້ອງ login, ບໍ່ມີ sidebar/topbar). ຄືກັນກັບ /track ແລະ /feedback.
 * ຕ້ອງເພີ່ມ "/report-repair" ໃນ PUBLIC ຂອງ src/proxy.ts.
 */
export const metadata: Metadata = {
  title: "ແຈ້ງສ້ອມອອນລາຍ | ODIEN Service",
  description: "ແຈ້ງສ້ອມເຄື່ອງກັບ ODIEN Service — ບໍ່ຕ້ອງເຂົ້າຮ້ານ",
  robots: { index: false, follow: false },
};

/**
 * ຕ້ອງມີ <DictProvider> ຢູ່ນີ້ເອງ — NoticeForm ເປັນ client component ທີ່ເອີ້ນ useDict()
 * ແລະ provider ຕົວດຽວທີ່ມີໃນລະບົບຢູ່ (app)/layout ເຊິ່ງ route ນີ້ບໍ່ໄດ້ຜ່ານ.
 * ຂາດອັນນີ້ໜ້າຈະລົ້ມເປັນ 500 ທັນທີ ("useDict must be used within DictProvider").
 */
export default async function ReportRepairLayout({ children }: { children: React.ReactNode }) {
  const dict = await getDictionary(await getLocale());
  return (
    <DictProvider dict={dict}>
      <main className="min-h-dvh bg-slate-50">
        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          <header className="mb-4 text-center">
            <Link href="/track" className="text-lg font-bold text-brand">
              ODIEN SERVICE
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">ແຈ້ງສ້ອມເຄື່ອງອອນລາຍ</p>
          </header>
          {children}
          <footer className="mt-6 text-center text-[11px] text-slate-400">
            <p>ສອບຖາມເພີ່ມເຕີມ ໂທ 77799899</p>
          </footer>
        </div>
      </main>
    </DictProvider>
  );
}
