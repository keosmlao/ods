import { type PurchaseStage, type PurchaseTrack } from "@/lib/erp-purchase";
import { AlertTriangle, Check } from "lucide-react";

/**
 * ຄວາມຄືບໜ້າການສັ່ງຊື້ອາໄຫຼ່ ຕາມທີ່ **ERP ບອກ** — stepper ແນວນອນ 5 ຂັ້ນ ແບບ Odoo:
 *
 *   ຂໍສະເໜີຊື້ → ອະນຸມັດ → ໃບສັ່ງຊື້ → ອະນຸມັດ PO → ຮັບເຂົ້າສາງ
 *   (SPR)       (WPRA)     (POT/POH)   (WPOA)       (PUIT/PUIH)
 *
 * ── ອອກແບບໃໝ່ (17-07-2026) ──
 * ແບບເກົ່າເປັນລາຍການຕັ້ງ 4 ຂັ້ນ — ສູງເກີນໄປສຳລັບຖັນຕາຕະລາງ ແລະ ບໍ່ມີຂັ້ນ WPOA/PUI.
 * ແບບໃໝ່: ຈຸດຕໍ່ເສັ້ນແນວນອນ (ຂຽວ=ຜ່ານ · ຟ້າ=ກຳລັງລໍ · ເທົາ=ຍັງ) + ແຖວທີສອງບອກ
 * **ຂັ້ນທີ່ກຳລັງລໍ + ເລກໃບຫຼ້າສຸດ + ວັນທີ** + ປ້າຍ "ຄ້າງ n ມື້" (ນັບຈາກການເຄື່ອນໄຫວ
 * ຫຼ້າສຸດຮອດມື້ນີ້). ທຸກຈຸດມີ tooltip ເລກໃບ — hover ເບິ່ງໄດ້ບໍ່ຕ້ອງເປີດ ERP.
 */

type Step = { label: string; no: string | null; date: string | null; at: PurchaseStage };

const ORDER: Record<PurchaseStage, number> = { requested: 0, approved: 1, ordered: 2, po_approved: 3, received: 4 };

/** DD-MM-YYYY → ຈຳນວນມື້ຫາມື້ນີ້ (null ຖ້າແປງບໍ່ໄດ້) */
function daysSince(date: string | null): number | null {
  if (!date) return null;
  const [d, m, y] = date.split("-").map(Number);
  if (!d || !m || !y) return null;
  const then = new Date(y, m - 1, d).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export function PurchaseState({ track, compact }: { track: PurchaseTrack | undefined; compact?: boolean }) {
  if (!track) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
        ບໍ່ພົບໃບຢູ່ ERP
      </span>
    );
  }

  const steps: Step[] = [
    { label: "ຂໍສະເໜີຊື້", no: track.pr_no, date: track.pr_date, at: "requested" },
    { label: "ອະນຸມັດ", no: track.approve_no, date: track.approve_date, at: "approved" },
    { label: "ໃບສັ່ງຊື້", no: track.order_no, date: track.order_date, at: "ordered" },
    { label: "ອະນຸມັດ PO", no: track.oa_no, date: track.oa_date, at: "po_approved" },
    { label: "ຮັບເຂົ້າສາງ", no: track.receipt_no, date: track.receipt_date, at: "received" },
  ];

  const now = ORDER[track.stage];
  /** ຂັ້ນທີ່ກຳລັງ**ລໍຖ້າ** = ຂັ້ນຖັດຈາກທີ່ ERP ເຮັດແລ້ວໄກສຸດ */
  const waiting = steps.find((step) => ORDER[step.at] === now + 1);
  const lastDone = [...steps].reverse().find((step) => ORDER[step.at] <= now && step.no);
  /**
   * ມາບໍ່ຄົບ — ໃບສັ່ງຊື້ໃບດຽວຮັບເຂົ້າມາເທື່ອລະສ່ວນໄດ້ ⇒ ມີໃບຮັບແລ້ວ ແຕ່ຍັງບໍ່ຄົບ
   * ຈຶ່ງຍັງບໍ່ນັບວ່າຜ່ານຂັ້ນສຸດທ້າຍ (syncErpPurchase ກໍ່ບໍ່ເລື່ອນຂັ້ນໃຫ້ຄືກັນ).
   */
  const partial = track.items > 1 && track.items_received > 0 && track.stage !== "received";
  // ຮັບເຂົ້າສາງແລ້ວ ແຕ່ວຽກຍັງຄ້າງຂັ້ນ "ກຳລັງສັ່ງຊື້" = ຕ້ອງລົງມື ⇒ ສີແດງ
  const stuck = track.stage === "received";
  // ຄ້າງມາດົນປານໃດ — ນັບຈາກການເຄື່ອນໄຫວຫຼ້າສຸດ (ໃບຫຼ້າສຸດທີ່ອອກ) ຮອດມື້ນີ້
  const idle = daysSince(lastDone?.date ?? null);

  return (
    <div className={compact ? "min-w-44 space-y-1" : "min-w-56 space-y-1.5"}>
      {/* ແຖວຈຸດ — ເສັ້ນທາງ 5 ຂັ້ນ, hover ເຫັນເລກໃບ */}
      <div className="flex items-center" aria-hidden={false}>
        {steps.map((step, index) => {
          const done = ORDER[step.at] <= now && Boolean(step.no);
          const current = ORDER[step.at] === now + 1;
          const alert = step.at === "received" && stuck;
          const size = compact ? "size-3" : "size-4";
          return (
            <span key={step.label} className={`flex items-center ${index > 0 ? "flex-1" : ""}`}>
              {index > 0 && (
                <span className={`h-0.5 min-w-2 flex-1 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
              <span
                title={`${step.label}${step.no ? ` · ${step.no}` : ""}${step.date ? ` · ${step.date}` : current ? " · ລໍຖ້າ" : ""}`}
                className={`grid ${size} shrink-0 place-items-center rounded-full border ${
                  alert
                    ? "border-red-600 bg-red-600 text-white"
                    : done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : current
                        ? "border-blue-600 bg-white ring-2 ring-blue-100"
                        : "border-slate-300 bg-white"
                }`}
              >
                {alert ? (
                  <AlertTriangle className={compact ? "size-2" : "size-2.5"} />
                ) : done ? (
                  <Check className={compact ? "size-2" : "size-2.5"} strokeWidth={4} />
                ) : null}
              </span>
            </span>
          );
        })}
      </div>

      {/* ແຖວຄວາມໝາຍ — ຂັ້ນທີ່ກຳລັງລໍ + ໃບຫຼ້າສຸດ + ອາຍຸ */}
      <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>
        {stuck ? (
          <span className="font-bold text-red-700">
            ຂອງຢູ່ສາງແລ້ວ{track.days_since_receipt !== null && ` ${track.days_since_receipt} ມື້`}
            {!compact && " — ວຽກຄວນໄປຕໍ່ໄດ້ແລ້ວ"}
          </span>
        ) : (
          <>
            <span className="font-semibold text-blue-700">ລໍ{waiting?.label ?? "-"}</span>
            {partial && (
              <span className="font-semibold text-amber-700">
                ມາ {track.items_received}/{track.items}
              </span>
            )}
            {idle !== null && idle > 0 && (
              <span
                className={`rounded px-1 py-px text-[9px] font-bold ${
                  idle >= 7 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                }`}
                title={`ເຄື່ອນໄຫວຫຼ້າສຸດ ${lastDone?.date ?? "-"} (${lastDone?.no ?? "-"})`}
              >
                ຄ້າງ {idle} ມື້
              </span>
            )}
          </>
        )}
        {lastDone?.no && (
          <span className="truncate font-mono text-[9px] text-slate-400" title={lastDone.no}>
            {lastDone.no}
            {lastDone.date && ` · ${lastDone.date}`}
          </span>
        )}
      </div>
    </div>
  );
}
