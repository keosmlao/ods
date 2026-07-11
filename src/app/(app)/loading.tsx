/**
 * ໜ້າຈໍລໍຖ້າ ຂອງທຸກໜ້າໃນກຸ່ມ (app).
 * Next.js ຈະສະແດງອັນນີ້ທັນທີທີ່ກົດປ່ຽນໜ້າ ແລ້ວສະຫຼັບເປັນເນື້ອຫາຈິງເມື່ອໂຫຼດເສັດ.
 */
export default function Loading() {
  return (
    <div className="w-full animate-pulse space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">ກຳລັງໂຫຼດ...</span>

      {/* ຫົວຂໍ້ + ປຸ່ມ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-lg bg-slate-200" />
          <div className="h-10 w-28 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* ແຖບຄົ້ນຫາ / ຕົວກອງ */}
      <div className="h-16 rounded-xl border border-slate-200 bg-white shadow-sm" />

      {/* ເນື້ອຫາ */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-10 rounded bg-slate-100" />
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex gap-4">
            <div className="h-6 w-16 rounded bg-slate-100" />
            <div className="h-6 flex-1 rounded bg-slate-100" />
            <div className="h-6 w-32 rounded bg-slate-100" />
            <div className="h-6 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
