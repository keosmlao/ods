import type { Metadata } from "next";
import Link from "next/link";

/**
 * ໜ້າຕິດຕາມສາທາລະນະ — ຢູ່ນອກກຸ່ມ (app) ຈຶ່ງ **ບໍ່ຜ່ານ** ການກວດ session
 * ໃນ src/app/(app)/layout.tsx (ບໍ່ຕ້ອງ login, ບໍ່ມີ sidebar/topbar).
 * ຄືກັນກັບ /feedback ແລະ /pr-view ທີ່ເປັນສາທາລະນະຢູ່ແລ້ວ.
 */
export const metadata: Metadata = {
  title: "ຕິດຕາມເຄື່ອງສ້ອມ | ODIEN Service",
  description: "ກວດສະຖານະເຄື່ອງທີ່ສົ່ງສ້ອມກັບ ODIEN Service",
  robots: { index: false, follow: false }, // ບໍ່ໃຫ້ search engine ເກັບໜ້າຂອງແຕ່ລະໃບ
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <header className="mb-4 text-center">
          <Link href="/track" className="text-lg font-bold text-[#0536a9]">
            ODIEN SERVICE
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">ຕິດຕາມເຄື່ອງສ້ອມ</p>
        </header>
        {children}
        <footer className="mt-6 text-center text-[11px] text-slate-400">
          <p>ສອບຖາມເພີ່ມເຕີມ ໂທ 77799899</p>
        </footer>
      </div>
    </main>
  );
}
