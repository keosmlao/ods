"use client";

import { deleteCustomer } from "@/app/actions/customer";
import { KindCell } from "@/components/service/kind-cell";
import { LinkPending } from "@/components/link-pending";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { Alert, DeleteButton, useActionAlert } from "@/components/manage/shared";
import { useDict } from "@/lib/i18n/context";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ChevronLeft, ChevronRight, Pencil, Phone, Plus, Search } from "lucide-react";
import Link from "next/link";

/**
 * ລາຍຊື່ລູກຄ້າ — ຕາຕະລາງດຽວກັບໜ້າ ກວດເຊັກ/ສ້ອມແປງ (text-xs, ຫົວຖັນຈັດຮຽງໄດ້, ແບ່ງໜ້າຢູ່ server).
 * ເປັນ client component ເພາະປຸ່ມລົບຕ້ອງຖາມຢືນຢັນ ແລະ ສະແດງຜົນການລົບ.
 */
export type CustomerRow = {
  code: string;
  name_1: string;
  name_2: string | null;
  address: string | null;
  tel: string | null;
  jobs: number;
  /** ຮ້ານຄ້າ / ທົ່ວໄປ — ໃຊ້ແຍກລາຍງານງານສ້ອມ (null = ຍັງບໍ່ລະບຸ) */
  cust_kind: "shop" | "general" | null;
};

/** ຕົງກັບ whitelist ຢູ່ຝັ່ງ server (customers/page.tsx) */
const columns = (t: Dictionary["customerTable"]): { key: string; label: string; defaultDir: SortDir }[] => [
  { key: "code", label: t.columnCode, defaultDir: "asc" },
  { key: "name", label: t.columnName, defaultDir: "asc" },
  { key: "tel", label: t.columnTel, defaultDir: "asc" },
  { key: "address", label: t.columnAddress, defaultDir: "asc" },
];

export function CustomerTable({
  rows,
  q,
  page,
  pageSize,
  total,
  pages,
  sort,
  dir,
  canUpdate = false,
}: {
  rows: CustomerRow[];
  q: string;
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  sort: string;
  dir: SortDir;
  /** ແກ້ຂໍ້ມູນລູກຄ້າໄດ້ບໍ — ຄຸມຊ່ອງ "ປະເພດ" (server ກວດຊ້ຳຢູ່ action) */
  canUpdate?: boolean;
}) {
  const { state: alert, setState: setAlert, clear } = useActionAlert();
  const t = useDict().customerTable;

  const base = () => ({ ...(q && { q }) });
  const sortHref = (key: string, nextDir: SortDir) =>
    `/customers?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/customers?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{t.heading}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {total.toLocaleString()} {t.items} · {t.page} {page}/{pages}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="size-4" />
          {t.addCustomer}
          <LinkPending className="size-3.5" />
        </Link>
      </div>

      <Alert state={alert} onClear={clear} />

      {/* ຄົ້ນຫາ — ກັບໄປໜ້າ 1 ສະເໝີ */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
          <Search className="size-3.5 shrink-0 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className="w-full text-xs outline-none"
          />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">{t.search}</button>
      </form>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="w-10 px-3 py-2.5 font-semibold">#</th>
                {columns(t).map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    sortKey={column.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={column.defaultDir}
                    className="py-2.5"
                  />
                ))}
                {/* ນັບຢູ່ 1 query ຕ່າງຫາກ ສະເພາະ 20 ແຖວຂອງໜ້ານີ້ ຈຶ່ງຈັດຮຽງບໍ່ໄດ້ (ຈະຕ້ອງນັບໝົດ 9,995 ລູກຄ້າ) */}
                {/* ປະເພດລູກຄ້າ — ລະບຸໄດ້ຈາກແຖວເລີຍ (ລາຍງານ /reports/service-by-kind ໃຊ້ຄ່ານີ້) */}
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.kind}</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">{t.receipt}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{row.code}</td>
                  <td className="max-w-64 px-3 py-2.5">
                    <span className="block truncate font-medium text-slate-800" title={row.name_1}>
                      {row.name_1}
                    </span>
                    {row.name_2 && (
                      <span className="block truncate text-[10px] text-slate-400" title={row.name_2}>
                        {row.name_2}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {row.tel ? (
                      <a href={`tel:${row.tel}`} className="inline-flex items-center gap-1 text-slate-700 hover:underline">
                        <Phone className="size-3 text-slate-400" />
                        {row.tel}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="max-w-80 truncate px-3 py-2.5 text-slate-600" title={row.address ?? ""}>
                    {row.address || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <KindCell code={row.code} value={row.cust_kind} canEdit={canUpdate} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {/* ລູກຄ້າທີ່ມີໃບຮັບເຄື່ອງແລ້ວ ລົບບໍ່ໄດ້ — ບອກໄວ້ກ່ອນ ຈຶ່ງບໍ່ຕ້ອງກົດແລ້ວຄ່ອຍຮູ້ */}
                    {row.jobs > 0 ? (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        {row.jobs.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/customers/${encodeURIComponent(row.code)}/edit`}
                        title={t.edit}
                        className="text-[#F27B1A] transition hover:opacity-70"
                      >
                        <Pencil className="size-4" />
                      </Link>
                      <DeleteButton
                        id={row.code}
                        action={deleteCustomer}
                        onResult={setAlert}
                        confirmText={t.deleteConfirm}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && <p className="py-12 text-center text-xs text-slate-400">{t.noResults}</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} {t.of} {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              {t.prev}
            </Link>
            <span className="px-3 font-medium text-slate-700">
              {page} / {pages}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.next}
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
