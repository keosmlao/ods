import { Elapsed } from "@/components/elapsed";
import { elapsedTone } from "@/lib/elapsed-tone";
import { stageLabel } from "@/lib/stage";
import type { BoardCard } from "@/components/service-board";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { HoldButtons } from "@/components/repair/hold-buttons";
import { ServiceDeleteButton } from "@/components/service/service-delete-button";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { PhotoThumb } from "@/components/service/photo-thumb";
import { MapPin, Pencil, Printer, ReceiptText, Tag } from "lucide-react";
import Link from "next/link";


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
              <th className="px-3 py-3" />
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
              {canHold && <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colHoldActions}</th>}
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => {
              const tone = elapsedTone(card.stage_seconds);
              const inWarranty = card.warranty === "ຮັບປະກັນ";
              return (
                <tr key={card.code} className="relative border-b border-slate-100 hover:bg-slate-50">
                  <td className="relative whitespace-nowrap px-3 py-3">
                    <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={`/service/${card.code}/print`}
                        target="_blank"
                        title={t.printTitle}
                        className="text-[#f6921e] hover:opacity-70"
                      >
                        <Printer className="size-4" />
                      </Link>
                      {/* ພິມສະຕິກເກີ 100×150mm (ປ້າຍ tracking + barcode) — ຕິດໃສ່ເຄື່ອງ */}
                      <Link
                        href={`/service/${card.code}/label`}
                        target="_blank"
                        title={t.printStickerTitle}
                        className="text-brand-700 hover:opacity-70"
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
                  <td className="relative whitespace-nowrap px-3 py-3 text-center font-bold text-brand">
                    {/* ແຖບສີບອກຄວາມດ່ວນ — ຄ້າງດົນເທົ່າໃດ ຍິ່ງແດງ */}
                    <Link href={`/service/${card.code}`} className="hover:underline">
                      {card.code}
                    </Link>
                    {card.is_claim && (
                      <span className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-brand-orange-300 px-1.5 py-0.5 text-[9px] font-bold text-brand-900 ring-1 ring-brand-orange-300" title="job claim — ໝາຍ/ມີໃບເຄມ">
                        <ReceiptText className="size-2.5" /> ເຄມ
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">{stageLabel(card.stage, card.service_type)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Elapsed
                      seconds={card.stage_seconds}
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${tone.chip}`}
                    />
                    {/* ນາລິກາຢຸດຢູ່ ⇒ ຕ້ອງບອກ ບໍ່ດັ່ງນັ້ນຄົນອ່ານເລກນີ້ຜິດ */}
                    {card.hold && <b className="mt-0.5 block text-[10px] text-brand-900">{t.clockStopped}</b>}
                  </td>
                  <td className="max-w-72 px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {/* ຮູບໜ້າປົກ — ກົດເປີດຮູບທັງໝົດ (ຮັບເຄື່ອງ · ກວດເຊັກ · ສ້ອມສຳເລັດ) */}
                      <PhotoThumb code={card.code} thumb={card.thumb} count={card.photo_count ?? 0} />
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-slate-800" title={card.product ?? ""}>
                          {card.product || "-"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-xs text-slate-400">{card.sn || "-"}</span>
                          {/* thumbnail ຮູບ check-in ໜ້າງານຈິງ (ຜ່ານ endpoint ເບົາ) — ກົດເຂົ້າໃບເບິ່ງເຕັມ */}
                          {card.checked_in && (
                            <Link
                              href={`/service/${card.code}`}
                              title={card.checked_out ? "check-in + ອອກໜ້າງານແລ້ວ — ກົດເບິ່ງ" : "check-in ໜ້າງານແລ້ວ — ກົດເບິ່ງ"}
                              className="relative shrink-0"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/checkin-photo/${card.code}`}
                                alt="check-in"
                                loading="lazy"
                                className={`size-7 rounded-md object-cover ring-2 ${card.checked_out ? "ring-slate-300" : "ring-brand-400"}`}
                              />
                              <MapPin
                                className={`absolute -bottom-1 -right-1 size-3 rounded-full bg-white p-px ${card.checked_out ? "text-slate-500" : "text-brand-700"}`}
                              />
                            </Link>
                          )}
                        </span>
                      </div>
                    </div>
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
                        inWarranty ? "bg-brand-50 text-brand-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {card.warranty || "-"}
                    </span>
                  </td>
                  {/* ໝາຍວ່າມີບັນຫາ — ວຽກຄາຢູ່ຂັ້ນດຽວດ້ວຍເຫດຜົນທີ່ຄິວແກ້ບໍ່ໄດ້ */}
                  {canHold && (
                    <td className="whitespace-nowrap px-3 py-3">
                      <HoldButtons key={card.hold ? "held" : "free"} code={card.code} hold={card.hold ?? null} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
