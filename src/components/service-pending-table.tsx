import { Elapsed } from "@/components/elapsed";
import { elapsedTone } from "@/lib/elapsed-tone";
import type { BoardCard } from "@/components/service-board";
import { STAGES } from "@/components/service-board";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { ServiceDeleteButton } from "@/components/service/service-delete-button";
import { Pencil, Printer } from "lucide-react";
import Link from "next/link";

const stageLabel = new Map(STAGES.map((stage) => [stage.id as number, stage.label]));

/** ຖັນທີ່ຈັດຮຽງໄດ້ — ຄ້າງດົນສຸດຂຶ້ນກ່ອນເປັນຄ່າຕັ້ງຕົ້ນ */
export const PENDING_SORTS = ["code", "status", "elapsed", "product", "brand", "customer", "technician", "creator"] as const;
export type PendingSort = (typeof PENDING_SORTS)[number];

const COLUMNS: { key: PendingSort; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ເລກທີ", defaultDir: "desc" },
  { key: "status", label: "ສະຖານະ", defaultDir: "asc" },
  { key: "elapsed", label: "ຄ້າງມາ", defaultDir: "desc" },
  { key: "product", label: "ຊື່ເຄືອງ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
  { key: "creator", label: "ຜູ້ສ້າງເອກະສານ", defaultDir: "asc" },
];

/** ວຽກທີ່ຍັງຄ້າງ — ຕາຕະລາງ, ກົດຫົວຖັນເພື່ອຈັດຮຽງ */
export function ServicePendingTable({
  canUpdate = false,
  canDelete = false,
  cards,
  sort,
  dir,
  sortHref,
}: {
  canUpdate?: boolean;
  /** ຜູ້ຈັດການເທົ່ານັ້ນ — ປຸ່ມລຶບຍ້ອນຄືນບໍ່ໄດ້ */
  canDelete?: boolean;
  cards: BoardCard[];
  sort: string;
  dir: SortDir;
  sortHref: (sort: string, dir: SortDir) => string;
}) {
  if (cards.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="py-10 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              {COLUMNS.map((column) => (
                <SortHeader
                  key={column.key}
                  label={column.label}
                  sortKey={column.key}
                  current={sort}
                  dir={dir}
                  href={sortHref}
                  defaultDir={column.defaultDir}
                  className={column.key === "code" ? "text-center" : ""}
                />
              ))}
              <th className="whitespace-nowrap px-3 py-3 font-semibold">ປະກັນ</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => {
              const tone = elapsedTone(card.stage_seconds);
              const inWarranty = card.warranty === "ຮັບປະກັນ";
              return (
                <tr key={card.code} className="relative border-b border-slate-100 hover:bg-slate-50">
                  <td className="relative whitespace-nowrap px-3 py-3 text-center font-bold text-[#0536a9]">
                    {/* ແຖບສີບອກຄວາມດ່ວນ — ຄ້າງດົນເທົ່າໃດ ຍິ່ງແດງ */}
                    <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                    <Link href={`/service/${card.code}`} className="hover:underline">
                      {card.code}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">{stageLabel.get(card.stage) ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Elapsed
                      seconds={card.stage_seconds}
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${tone.chip}`}
                    />
                  </td>
                  <td className="max-w-72 px-3 py-3">
                    <span className="block truncate font-medium text-slate-800" title={card.product ?? ""}>
                      {card.product || "-"}
                    </span>
                    <span className="block truncate text-xs text-slate-400">{card.sn || "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{card.brand || "-"}</td>
                  <td className="max-w-48 truncate px-3 py-3" title={card.customer ?? ""}>
                    {card.customer || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{card.technician || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{card.creator || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {card.warranty || "-"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={`/service/${card.code}/print`}
                        target="_blank"
                        title="ພິມ"
                        className="text-[#D35400] hover:opacity-70"
                      >
                        <Printer className="size-4" />
                      </Link>
                      {canUpdate && (
                        <Link href={`/service/${card.code}/edit`} title="ແກ້ໄຂ" className="text-slate-500 hover:opacity-70">
                          <Pencil className="size-4" />
                        </Link>
                      )}
                      {/* ລຶບໃບຮັບເຄື່ອງ — ຜູ້ຈັດການເທົ່ານັ້ນ (server ກວດຊ້ຳ) */}
                      {canDelete && <ServiceDeleteButton code={card.code} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
