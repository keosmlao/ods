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

export default function ReportRepairLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <header className="mb-4 text-center">
          <Link href="/track" className="text-lg font-bold text-[#0536a9]">
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
  );
}
