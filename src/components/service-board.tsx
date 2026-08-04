import { Elapsed } from "@/components/elapsed";
import { elapsedTone } from "@/lib/elapsed-tone";
import type { JobHold } from "@/lib/job-hold";
import { STAGE_LABEL } from "@/lib/stage";
import { Pencil, Printer, ReceiptText, Tag } from "lucide-react";
import Link from "next/link";

/**
 * ຂັ້ນຂອງວຽກທີ່ຍັງຄ້າງ (1..11) — **ປ້າຍດຶງຈາກ `STAGE_LABEL` ບ່ອນດຽວ**, ບ່ອນນີ້ຖືແຕ່ສີ.
 *
 * ແຕ່ກ່ອນພິມປ້າຍໄວ້ນີ້ເອງ ⇒ ພໍເພີ່ມຂັ້ນ QC ເລກເລື່ອນ ແຕ່ບ່ອນນີ້ບໍ່ໄດ້ເລື່ອນນຳ:
 * ງານທີ່ລໍກວດ QC ຂຶ້ນວ່າ "ລໍຖ້າສົ່ງຄືນ" ແລະ ຂັ້ນ 11 ຫຼົ່ນອອກຈາກທັງກະດານ ແລະ ຕົວກອງ.
 */
const ACCENT: Record<number, string> = {
  // ໜ້າ /service ເປັນ **ທະບຽນຮັບເຄື່ອງປະຈຳວັນ (ທຸກສະຖານະ)** ⇒ ຕ້ອງມີຖັນ 0/12/-1 ນຳ,
  // ບໍ່ດັ່ງນັ້ນໃບທີ່ຢູ່ຂັ້ນເຫຼົ່ານັ້ນຈະ **ຫາຍງຽບ** ຈາກກະດານ (ຕາຕະລາງເຫັນ ແຕ່ກະດານບໍ່ເຫັນ)
  [-1]: "bg-brand-orange-700",
  0: "bg-slate-400",
  1: "bg-slate-400",
  2: "bg-brand-500",
  3: "bg-slate-400",
  4: "bg-brand-500",
  5: "bg-slate-400",
  6: "bg-brand-500",
  7: "bg-brand-orange-500",
  8: "bg-slate-400",
  9: "bg-brand-orange-500",
  10: "bg-brand-600",
  11: "bg-brand-700",
  12: "bg-brand-700",
  13: "bg-brand-orange-500",
  14: "bg-brand-700",
  15: "bg-brand-orange-500",
  16: "bg-brand-600",
};

export const STAGES = Object.entries(ACCENT).map(([stage, accent]) => ({
  id: Number(stage),
  label: STAGE_LABEL[Number(stage)],
  accent,
}));

export type BoardCard = {
  code: string;
  /** ຂັ້ນຂອງວຽກ (ຈາກ STAGE_SQL) */
  stage: number;
  /**
   * ປະເພດບໍລິການ (CI/ST/IH/PS) — **ຈຳເປັນສຳລັບປ້າຍຂັ້ນ**: ຂັ້ນ 0 ຂອງ IH ແມ່ນ
   * "ລໍນັດໝາຍ/ຈັດຊ່າງໄປສ້ອມ" ບໍ່ແມ່ນ "ລໍໄປຮັບເຄື່ອງ" ຂອງ PS (ເບິ່ງ lib/stage.stageLabel)
   */
  service_type: string | null;
  job_kind?: "repair" | "claim";
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
  /** ໝາຍເຫດ (tb_product.remark) — ແກ້ໄດ້ໃນຕາຕະລາງ ບໍ່ຕ້ອງເປີດໃບ */
  remark?: string | null;
  /** ຮູບໜ້າປົກ (product_image ຮູບທຳອິດ) — ໃຫ້ຕາຕະລາງໂຊ້ thumbnail · null = ບໍ່ມີ */
  thumb?: string | null;
  /** ຈຳນວນຮູບທັງໝົດ (ຮັບເຄື່ອງ + ກວດເຊັກ + ສ້ອມສຳເລັດ) */
  photo_count?: number;
  /** ຊ່າງ check-in ໜ້າງານແລ້ວ (ມີຮູບ+ພິກັດ) — ໃຫ້ລາຍการ ໂຊ້ໄອຄອນ */
  checked_in?: boolean;
  /** check-out ແລ້ວ (ຈົບงาน/ອອກໜ້າງານ) */
  checked_out?: boolean;
  /** ທຸງ "ມີບັນຫາ" ທີ່ເປີດຢູ່ — null = ປົກກະຕິ (ເບິ່ງ src/lib/job-hold.ts) */
  hold?: JobHold | null;
  /** job claim — ໝາຍ ເຄມ supplier ຫຼື ມີໃບເຄມຜູກ (ໃຫ້ list ໂຊ້ badge "ເຄມ") */
  is_claim?: boolean;
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
          <span className="flex min-w-0 items-center gap-1.5">
            <Link href={`/service/${card.code}`} className="font-bold text-brand hover:underline">
              #{card.code}
            </Link>
            {card.is_claim && (
              <span className="inline-flex items-center gap-0.5 rounded bg-brand-orange-300 px-1.5 py-0.5 text-[10px] font-bold text-brand-900 ring-1 ring-brand-orange-300" title="job claim — ໝາຍ/ມີໃບເຄມ">
                <ReceiptText className="size-3" /> ເຄມ
              </span>
            )}
          </span>
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
              inWarranty ? "bg-brand-50 text-brand-800" : "bg-slate-100 text-slate-500"
            }`}
          >
            {card.warranty || "-"}
          </span>

          {/* ປຸ່ມໂຜ່ຂຶ້ນເມື່ອເອົາເມົ້າຊີ້ — ບໍ່ລົບກວນສາຍຕາຕອນອ່ານ */}
          <div className="flex items-center gap-2.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <Link href={`/service/${card.code}/print`} target="_blank" title="ພິມ" className="text-[#f6921e] hover:opacity-70">
              <Printer className="size-3.5" />
            </Link>
            <Link href={`/service/${card.code}/label`} target="_blank" title="ພິມສະຕິກເກີ" className="text-brand-700 hover:opacity-70">
              <Tag className="size-3.5" />
            </Link>
            <Link href={`/service/${card.code}/edit`} title="ແກ້ໄຂ" className="text-slate-500 hover:opacity-70">
              <Pencil className="size-3.5" />
            </Link>
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
                <span title={`${stale} ໃບຄ້າງເກີນ 7 ມື້`} className="rounded bg-brand-orange-100 px-1.5 text-xs font-bold text-brand-orange-700">
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
