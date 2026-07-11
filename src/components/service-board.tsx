import { DeleteServiceButton } from "@/components/service-delete-button";
import { Elapsed } from "@/components/elapsed";
import { elapsedTone } from "@/lib/elapsed-tone";
import { Pencil, Printer } from "lucide-react";
import Link from "next/link";

/** 10 ຂັ້ນຂອງວຽກທີ່ຍັງຄ້າງ — ຕາມ STAGE_SQL (src/lib/stage.ts) */
export const STAGES = [
  { id: 1, label: "ລໍຖ້າກວດເຊັກ", accent: "bg-slate-400" },
  { id: 2, label: "ກຳລັງກວດເຊັກ", accent: "bg-sky-500" },
  { id: 3, label: "ລໍຖ້າສະເໜີລາຄາ", accent: "bg-slate-400" },
  { id: 4, label: "ກຳລັງສະເໜີລາຄາ", accent: "bg-sky-500" },
  { id: 5, label: "ລໍຖ້າເບີກອາໄຫຼ່", accent: "bg-slate-400" },
  { id: 6, label: "ກຳລັງເບີກອາໄຫຼ່", accent: "bg-sky-500" },
  { id: 7, label: "ກຳລັງສັ່ງຊື້ອາໄຫຼ່", accent: "bg-violet-500" },
  { id: 8, label: "ລໍຖ້າສ້ອມແປງ", accent: "bg-slate-400" },
  { id: 9, label: "ກຳລັງສ້ອມແປງ", accent: "bg-amber-500" },
  { id: 10, label: "ລໍຖ້າສົ່ງຄືນ", accent: "bg-emerald-500" },
] as const;

export type BoardCard = {
  code: string;
  /** ຂັ້ນຂອງວຽກ 1..10 (ຈາກ STAGE_SQL) */
  stage: number;
  customer: string | null;
  product: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  technician: string | null;
  /** ຜູ້ສ້າງເອກະສານ (ຄົນທີ່ຮັບເຄື່ອງເຂົ້າ) */
  creator: string | null;
  /** ວິນາທີທີ່ຄ້າງຢູ່ຂັ້ນນີ້ — ໜ້າຈໍນັບຕໍ່ເອງທຸກວິນາທີ */
  stage_seconds: number | null;
};

function Card({ card }: { card: BoardCard }) {
  const stage = elapsedTone(card.stage_seconds);
  const inWarranty = card.warranty === "ຮັບປະກັນ";

  return (
    <article className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
      {/* ແຖບຊ້າຍ = ຄວາມດ່ວນ (ຄ້າງດົນເທົ່າໃດ ຍິ່ງແດງ) */}
      <span className={`absolute inset-y-0 left-0 w-1 ${stage.bar}`} aria-hidden />

      <div className="space-y-2 py-3 pl-4 pr-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/service/${card.code}`} className="font-bold text-[#0536a9] hover:underline">
            #{card.code}
          </Link>
          <Elapsed seconds={card.stage_seconds} className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${stage.chip}`} />
        </div>

        <div>
          <p className="truncate text-sm font-medium text-slate-800" title={card.product ?? ""}>
            {card.product || "-"}
          </p>
          <p className="truncate text-xs text-slate-500" title={`${card.brand ?? ""} · ${card.sn ?? ""}`}>
            {card.brand || "-"} · {card.sn || "-"}
          </p>
        </div>

        <div className="space-y-0.5 text-xs">
          <p className="truncate text-slate-600" title={card.customer ?? ""}>
            <span className="text-slate-400">ລູກຄ້າ </span>
            {card.customer || "-"}
          </p>
          <p className="truncate text-slate-600">
            <span className="text-slate-400">ຊ່າງ </span>
            {card.technician || "-"}
          </p>
          <p className="truncate text-slate-600">
            <span className="text-slate-400">ຜູ້ສ້າງ </span>
            {card.creator || "-"}
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {card.warranty || "-"}
          </span>

          {/* ປຸ່ມໂຜ່ຂຶ້ນເມື່ອເອົາເມົ້າຊີ້ — ບໍ່ລົບກວນສາຍຕາຕອນອ່ານ */}
          <div className="flex items-center gap-2.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <Link href={`/service/${card.code}/print`} target="_blank" title="ພິມ" className="text-[#D35400] hover:opacity-70">
              <Printer className="size-3.5" />
            </Link>
            <Link href={`/service/${card.code}/edit`} title="ແກ້ໄຂ" className="text-slate-500 hover:opacity-70">
              <Pencil className="size-3.5" />
            </Link>
            <DeleteServiceButton code={card.code} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ServiceBoard({ cards }: { cards: BoardCard[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        // ເກົ່າສຸດຂຶ້ນເທິງ — ໃບທີ່ຄ້າງດົນສຸດຄືໃບທີ່ຕ້ອງຮີບ
        const column = cards
          .filter((card) => card.stage === stage.id)
          .sort((a, b) => (b.stage_seconds ?? 0) - (a.stage_seconds ?? 0));

        const stale = column.filter((card) => (card.stage_seconds ?? 0) >= 7 * 86400).length;

        return (
          <section key={stage.id} className="flex w-64 shrink-0 flex-col rounded-xl bg-slate-100/80">
            <header className="sticky top-0 z-10 flex items-center gap-2 rounded-t-xl bg-slate-100 px-3 py-2.5">
              <span className={`size-2 shrink-0 rounded-full ${stage.accent}`} />
              <h2 className="flex-1 truncate text-sm font-bold text-slate-700" title={stage.label}>
                {stage.label}
              </h2>
              {stale > 0 && (
                <span title={`${stale} ໃບຄ້າງເກີນ 7 ມື້`} className="rounded bg-red-100 px-1.5 text-xs font-bold text-red-700">
                  {stale}
                </span>
              )}
              <span className="grid min-w-6 place-items-center rounded-full bg-white px-1.5 py-0.5 text-xs font-bold text-slate-600">
                {column.length}
              </span>
            </header>

            <div className="flex flex-col gap-2 p-2">
              {column.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">ບໍ່ມີວຽກ</p>
              ) : (
                column.map((card) => <Card key={card.code} card={card} />)
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
