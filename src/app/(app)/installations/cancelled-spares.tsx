"use client";
import { startInstallReturnRequest } from "@/app/actions/installation-returns";
import { useConfirm } from "@/components/confirm-dialog";
import { AlertTriangle, LoaderCircle, Undo2 } from "lucide-react";
import { useTransition } from "react";
import type { SpareDoc } from "./outstanding";

/**
 * ຄຳເຕືອນ "ອາໄຫຼ່ຍັງຄ້າງນອກສາງ" ຂອງງານຕິດຕັ້ງທີ່ຖືກຍົກເລີກ (B5) —
 * ຖອດແບບຈາກ approvals/cancellations/outstanding-spares.tsx ຂອງຝັ່ງສ້ອມ.
 *
 * ບໍ່ຍ້າຍສະຕັອກເອງ — ປຸ່ມພາໄປຂັ້ນຕອນເກົ່າ: startInstallReturnRequest(ໃບເບີກ) →
 * /installations/spare-returns/<ໃບເບີກ> → ໃບຂໍສົ່ງຄືນ SRI (59) → ສາງຮັບຄືນ SRT (58).
 */
export function CancelledSpares({ jobs }: { jobs: { code: string; docs: SpareDoc[] }[] }) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  if (jobs.length === 0) return null;

  const totalLines = jobs.reduce(
    (sum, job) => sum + job.docs.reduce((n, doc) => n + doc.lines.length, 0),
    0,
  );

  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50 shadow-sm">
      {dialog}
      <div className="flex flex-wrap items-start gap-2 border-b border-amber-200 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-56 flex-1">
          <h2 className="text-sm font-bold text-amber-800">ອາໄຫຼ່ຂອງງານທີ່ຍົກເລີກ ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ</h2>
          <p className="mt-0.5 text-xs text-amber-700">
            ມີ {jobs.length} ງານທີ່ຖືກຍົກເລີກ ແຕ່ຍັງມີອາໄຫຼ່ທີ່ເບີກອອກຈາກສາງແລ້ວ <b>{totalLines} ລາຍການ</b>{" "}
            ຄ້າງຢູ່ນອກສາງ. ກະລຸນາສ້າງ <b>ໃບຂໍສົ່ງອາໄຫຼ່ຄືນ</b> ໃຫ້ແຕ່ລະໃບເບີກ ແລ້ວໃຫ້ສາງຮັບຄືນ.
          </p>
        </div>
      </div>

      <div className="divide-y divide-amber-200">
        {jobs.map((job) =>
          job.docs.map((doc) => {
            const units = doc.lines.reduce((n, line) => n + Number(line.qty || 0), 0);
            return (
              <div key={`${job.code}-${doc.doc_no}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-56 flex-1">
                  <p className="text-xs font-bold text-slate-800">
                    {job.code} · ໃບເບີກ {doc.doc_no}
                    <span className="ml-2 font-normal text-slate-500">{doc.doc_date ?? "-"}</span>
                    <span className="ml-2 font-normal text-slate-500">
                      ({doc.lines.length} ລາຍການ · {units.toLocaleString()} ໜ່ວຍ)
                    </span>
                  </p>
                  <ul className="mt-1 space-y-0.5">
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
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    const ok = await ask({
                      title: "ຂໍສົ່ງຄືນອາໄຫຼ່?",
                      message: (
                        <>
                          ອາໄຫຼ່ຂອງໃບເບີກ <b className="text-slate-700">{doc.doc_no}</b> ຈະຖືກກ໋ອບໄປໃສ່ໃບຂໍສົ່ງຄືນ
                        </>
                      ),
                      confirmLabel: "ຂໍສົ່ງ​ຄືນ",
                    });
                    if (!ok) return;
                    const data = new FormData();
                    data.set("doc_no", doc.doc_no);
                    start(() => void startInstallReturnRequest(data));
                  }}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                >
                  {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
                  ຂໍສົ່ງຄືນອາໄຫຼ່
                </button>
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
