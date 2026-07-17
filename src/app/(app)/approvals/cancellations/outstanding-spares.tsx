"use client";
import { startReturnRequest } from "@/app/actions/stock";
import { useConfirm } from "@/components/confirm-dialog";
import { AlertTriangle, LoaderCircle, Undo2 } from "lucide-react";
import { useTransition } from "react";
import type { OutstandingSpare } from "@/lib/outstanding-spares";

/**
 * ຄຳເຕືອນ "ອາໄຫຼ່ຍັງຄ້າງນອກສາງ" ຂອງໃບຮັບເຄື່ອງທີ່ຖືກຍົກເລີກ (GAP B).
 *
 * ບໍ່ຍ້າຍສະຕັອກເອງ — ປຸ່ມພາໄປຂັ້ນຕອນເກົ່າ: startReturnRequest(ໃບເບີກ) →
 * /stock/returns/<ໃບເບີກ> → ໃບຂໍສົ່ງອາໄຫຼ່ຄືນ (59) → ສາງຮັບຄືນ (58).
 */
export type SpareDoc = { doc_no: string; doc_date: string | null; lines: OutstandingSpare[] };

export function OutstandingSpares({ code, docs }: { code: string; docs: SpareDoc[] }) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();

  if (docs.length === 0) return null;

  const lines = docs.reduce((sum, doc) => sum + doc.lines.length, 0);
  const units = docs.reduce(
    (sum, doc) => sum + doc.lines.reduce((n, line) => n + Number(line.qty || 0), 0),
    0,
  );

  return (
    <section className="overflow-hidden rounded-xl border border-amber-300 bg-amber-50 shadow-sm">
      {dialog}
      <div className="flex flex-wrap items-start gap-2 border-b border-amber-200 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-56 flex-1">
          <h2 className="text-sm font-bold text-amber-800">ອາໄຫຼ່ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ</h2>
          <p className="mt-0.5 text-xs text-amber-700">
            ໃບຮັບເຄື່ອງ {code} ຖືກຍົກເລີກ ແຕ່ຍັງມີອາໄຫຼ່ທີ່ເບີກອອກຈາກສາງແລ້ວ{" "}
            <b>{lines} ລາຍການ</b> ({units.toLocaleString()} ໜ່ວຍ) ຈາກ {docs.length} ໃບເບີກ ຍັງຄ້າງຢູ່ນອກສາງ.
            ກະລຸນາສ້າງ <b>ໃບຂໍສົ່ງອາໄຫຼ່ຄືນ</b> ໃຫ້ແຕ່ລະໃບເບີກ ແລ້ວໃຫ້ສາງຮັບຄືນ.
          </p>
        </div>
      </div>

      <div className="divide-y divide-amber-200">
        {docs.map((doc) => (
          <div key={doc.doc_no} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-56 flex-1">
              <p className="text-xs font-bold text-slate-800">
                ໃບເບີກ {doc.doc_no}
                <span className="ml-2 font-normal text-slate-500">{doc.doc_date ?? "-"}</span>
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
                start(() => void startReturnRequest(data));
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
              ຂໍສົ່ງຄືນອາໄຫຼ່
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
