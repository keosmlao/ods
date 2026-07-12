import { AlertTriangle } from "lucide-react";
import type { SpareDoc } from "./outstanding";

/**
 * ຄຳເຕືອນ "ອາໄຫຼ່ຍັງຄ້າງນອກສາງ" ຂອງງານຕິດຕັ້ງທີ່ຖືກຍົກເລີກ — **ບອກໃຫ້ຮູ້ຢ່າງດຽວ**.
 *
 * ໜ້ານີ້ (/installations) ເປັນຂອງ **CS** ແຕ່ຂະບວນການອາໄຫຼ່ເປັນ **ຊ່າງ ກັບ ສາງ** ເທົ່ານັ້ນ
 * (ເບິ່ງ RETURN_SIDE ໃນ lib/roles): ຊ່າງຂໍຄືນ → ສາງຮັບເຂົ້າສາງ (ບວກສະຕັອກ ERP).
 * ⇒ ບໍ່ມີປຸ່ມລົງມືຢູ່ບ່ອນນີ້. ຖ້າໃສ່ປຸ່ມໄວ້ CS ກົດແລ້ວຈະເດັ້ງໄປ /forbidden ຢູ່ດີ.
 *
 * ວຽກຈິງເກີດຢູ່ແທັບ "ຍົກເລີກ — ຖ້າສົ່ງຄືນ" ຂອງ /stock/returns ເຊິ່ງດຶງໃບເບີກພວກນີ້
 * ມາໃຫ້ຊ່າງ/ສາງ ພ້ອມປຸ່ມສ້າງໃບຂໍຄືນ. cancelInstall ກໍ່ແຈ້ງເຕືອນສາງໃຫ້ແລ້ວ.
 * ບ່ອນນີ້ພຽງແຕ່ໃຫ້ CS **ເຫັນ** ວ່າງານທີ່ຕົນຍົກເລີກຍັງມີຂອງຄ້າງຢູ່ ແລະ ຕິດຕາມໄດ້.
 */
export function CancelledSpares({ jobs }: { jobs: { code: string; docs: SpareDoc[] }[] }) {
  if (jobs.length === 0) return null;

  const totalLines = jobs.reduce((sum, job) => sum + job.docs.reduce((n, doc) => n + doc.lines.length, 0), 0);

  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50 shadow-sm">
      <div className="flex flex-wrap items-start gap-2 border-b border-amber-200 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-56 flex-1">
          <h2 className="text-sm font-bold text-amber-800">ອາໄຫຼ່ຂອງງານທີ່ຍົກເລີກ ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ</h2>
          <p className="mt-0.5 text-xs text-amber-700">
            ມີ {jobs.length} ງານທີ່ຖືກຍົກເລີກ ແຕ່ຍັງມີອາໄຫຼ່ທີ່ເບີກອອກຈາກສາງແລ້ວ <b>{totalLines} ລາຍການ</b>{" "}
            ຄ້າງຢູ່ນອກສາງ. ການສົ່ງຄືນເປັນວຽກຂອງ <b>ຊ່າງ ແລະ ສາງ</b> — ໃບເບີກລຸ່ມນີ້ຂຶ້ນຢູ່ແທັບ{" "}
            <b>&quot;ຍົກເລີກ — ຖ້າສົ່ງຄືນ&quot;</b> ຂອງໜ້າສົ່ງຄືນອາໄຫຼ່ແລ້ວ ແລະ ສາງໄດ້ຮັບການແຈ້ງເຕືອນແລ້ວ.
          </p>
        </div>
      </div>

      <div className="divide-y divide-amber-200">
        {jobs.map((job) =>
          job.docs.map((doc) => {
            const units = doc.lines.reduce((n, line) => n + Number(line.qty || 0), 0);
            return (
              <div key={`${job.code}-${doc.doc_no}`} className="px-4 py-3">
                <p className="text-xs font-bold text-slate-800">
                  {job.code} · ໃບເບີກ {doc.doc_no}
                  <span className="ml-2 font-normal text-slate-500">{doc.doc_date ?? "-"}</span>
                  <span className="ml-2 font-normal text-slate-500">
                    ({doc.lines.length} ລາຍການ · {units.toLocaleString()} ໜ່ວຍ)
                  </span>
                </p>
                <ul className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
                  {doc.lines.map((line, index) => (
                    <li key={`${doc.doc_no}-${line.item_code}-${index}`} className="text-xs text-slate-600">
                      {line.item_code} · {line.item_name || "-"} ·{" "}
                      <b className="text-slate-800">
                        {Number(line.qty).toLocaleString()} {line.unit_code ?? ""}
                      </b>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
