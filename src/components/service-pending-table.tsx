import { Elapsed } from "@/components/elapsed";
import { elapsedTone } from "@/lib/elapsed-tone";
import type { BoardCard } from "@/components/service-board";
import { STAGES } from "@/components/service-board";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { HoldButtons } from "@/components/repair/hold-buttons";
import { RemarkCell } from "@/components/service/remark-cell";
import { ServiceDeleteButton } from "@/components/service/service-delete-button";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { Pencil, Printer, Tag } from "lucide-react";
import Link from "next/link";

const stageLabel = new Map(STAGES.map((stage) => [stage.id as number, stage.label]));

/** ຖັນທີ່ຈັດຮຽງໄດ້ — ຄ້າງດົນສຸດຂຶ້ນກ່ອນເປັນຄ່າຕັ້ງຕົ້ນ */
export const PENDING_SORTS = ["code", "status", "elapsed", "product", "brand", "customer", "technician", "creator"] as const;
export type PendingSort = (typeof PENDING_SORTS)[number];

const columnsFor = (t: Dictionary["servicePendingTable"]): { key: PendingSort; label: string; defaultDir: SortDir }[] => [
  { key: "code", label: t.colCode, defaultDir: "desc" },
  { key: "status", label: t.colStatus, defaultDir: "asc" },
  { key: "elapsed", label: t.colElapsed, defaultDir: "desc" },
  { key: "product", label: t.colProduct, defaultDir: "asc" },
  { key: "brand", label: t.colBrand, defaultDir: "asc" },
  { key: "customer", label: t.colCustomer, defaultDir: "asc" },
  { key: "technician", label: t.colTechnician, defaultDir: "asc" },
  { key: "creator", label: t.colCreator, defaultDir: "asc" },
];

/** ວຽກທີ່ຍັງຄ້າງ — ຕາຕະລາງ, ກົດຫົວຖັນເພື່ອຈັດຮຽງ */
export async function ServicePendingTable({
  canUpdate = false,
  canDelete = false,
  canHold = false,
  cards,
  sort,
  dir,
  sortHref,
}: {
  canUpdate?: boolean;
  /** ຜູ້ຈັດການເທົ່ານັ້ນ — ປຸ່ມລຶບຍ້ອນຄືນບໍ່ໄດ້ */
  canDelete?: boolean;
  /**
   * ຫົວໜ້າ/ຜູ້ມີສິດອະນຸມັດເທົ່ານັ້ນ — ທຸງ "ມີບັນຫາ" **ຢຸດນາລິກາ KPI**
   * ⇒ ຖ້າໃຜກໍ່ໝາຍໄດ້ ມັນຈະກາຍເປັນບ່ອນລີ້ຄວາມຊັກຊ້າ (server ກວດຊ້ຳຢູ່ດີ).
   */
  canHold?: boolean;
  cards: BoardCard[];
  sort: string;
  dir: SortDir;
  sortHref: (sort: string, dir: SortDir) => string;
}) {
  const t = (await getDictionary(await getLocale())).servicePendingTable;
  if (cards.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="py-10 text-center text-sm text-slate-400">{t.noResults}</p>
      </section>
    );
  }
  const columns = columnsFor(t);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1480px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              {columns.map((column) => (
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
              <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colWarranty}</th>
              {/* ໝາຍເຫດ — ຂຽນໄດ້ຢູ່ນີ້ເລີຍ (ບໍ່ຕ້ອງເປີດເຂົ້າໃບ) */}
              <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colRemark}</th>
              {canHold && <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colHoldActions}</th>}
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
                    {/* ນາລິກາຢຸດຢູ່ ⇒ ຕ້ອງບອກ ບໍ່ດັ່ງນັ້ນຄົນອ່ານເລກນີ້ຜິດ */}
                    {card.hold && <b className="mt-0.5 block text-[10px] text-amber-600">{t.clockStopped}</b>}
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
                  {/* ໝາຍເຫດ — ກົດພິມໄດ້ເລີຍ (ສິດດຽວກັບການແກ້ໃບ · server ກວດຊ້ຳ) */}
                  <td className="w-56 min-w-44 px-3 py-3">
                    <RemarkCell code={card.code} value={card.remark ?? null} canEdit={canUpdate} />
                  </td>
                  {/* ໝາຍວ່າມີບັນຫາ — ວຽກຄາຢູ່ຂັ້ນດຽວດ້ວຍເຫດຜົນທີ່ຄິວແກ້ບໍ່ໄດ້ */}
                  {canHold && (
                    <td className="whitespace-nowrap px-3 py-3">
                      <HoldButtons key={card.hold ? "held" : "free"} code={card.code} hold={card.hold ?? null} />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={`/service/${card.code}/print`}
                        target="_blank"
                        title={t.printTitle}
                        className="text-[#D35400] hover:opacity-70"
                      >
                        <Printer className="size-4" />
                      </Link>
                      {/* ພິມສະຕິກເກີ 100×150mm (ປ້າຍ tracking + barcode) — ຕິດໃສ່ເຄື່ອງ */}
                      <Link
                        href={`/service/${card.code}/label`}
                        target="_blank"
                        title={t.printStickerTitle}
                        className="text-teal-600 hover:opacity-70"
                      >
                        <Tag className="size-4" />
                      </Link>
                      {canUpdate && (
                        <Link href={`/service/${card.code}/edit`} title={t.editTitle} className="text-slate-500 hover:opacity-70">
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
