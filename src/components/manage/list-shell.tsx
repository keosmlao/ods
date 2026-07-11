import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SortHeader, type SortDir } from "@/components/sort-header";

/**
 * ໂຄງໜ້າ "ລາຍການ" ຂອງຂໍ້ມູນຫຼັກ — ຖອດແບບຈາກໜ້າ /checking ແລະ /manage/suppliers
 * (ຫົວຂໍ້ + ຈຳນວນ · ຄົ້ນຫາ · ຫົວຖັນຈັດຮຽງໄດ້ · ຕາຕະລາງ text-xs · ແບ່ງໜ້າຢູ່ຝັ່ງ server)
 *
 * ຄົ້ນຫາ ແລະ ຈັດຮຽງ ແລະ ແບ່ງໜ້າ ເຮັດຢູ່ຝັ່ງ server ທັງໝົດ —
 * ods ດຶງທຸກແຖວອອກມາໜ້າດຽວແລ້ວປ່ອຍໃຫ້ DataTables ຈັດການຢູ່ browser
 */

/** ຖັນທີ່ບໍ່ມີ key = ຈັດຮຽງບໍ່ໄດ້ (ຫົວຖັນທຳມະດາ) */
export type ListColumn = { key?: string; label: string; defaultDir?: SortDir; className?: string };

/** ຈຳນວນແຖວຕໍ່ໜ້າ — ຄືກັນທຸກໜ້າຂອງລະບົບ */
export const PAGE_SIZE = 20;

export function ListShell({
  title,
  subtitle,
  total,
  page,
  perPage,
  pages,
  q = "",
  searchPlaceholder,
  hidden = {},
  columns,
  sort,
  dir,
  sortHref,
  pageHref,
  minWidth = 800,
  headerAction,
  filters,
  alert,
  actions = true,
  children,
  empty = "ບໍ່ພົບລາຍການ",
}: {
  title: string;
  subtitle?: ReactNode;
  total: number;
  page: number;
  perPage: number;
  pages: number;
  q?: string;
  searchPlaceholder: string;
  /** ຄ່າກອງອື່ນທີ່ຕ້ອງພາໄປນຳຕອນຄົ້ນຫາ (ເຊັ່ນ: ແຂວງ) */
  hidden?: Record<string, string>;
  columns: ListColumn[];
  sort: string;
  dir: SortDir;
  sortHref: (sort: string, dir: SortDir) => string;
  pageHref: (page: number) => string;
  minWidth?: number;
  /** ປຸ່ມ "ເພີ່ມ" ຢູ່ມູມຂວາເທິງ */
  headerAction?: ReactNode;
  /** ຕົວກອງເພີ່ມ (ວາງໄວ້ຊ້າຍຊ່ອງຄົ້ນຫາ) */
  filters?: ReactNode;
  alert?: ReactNode;
  /** ມີຖັນປຸ່ມ (ແກ້ໄຂ/ລົບ) ທ້າຍແຖວບໍ່ */
  actions?: boolean;
  children: ReactNode;
  empty?: string;
}) {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {subtitle && <>{subtitle} · </>}
            {total.toLocaleString()} ລາຍການ · ໜ້າ {page}/{pages}
          </p>
        </div>
        {headerAction}
      </div>

      {alert}

      {/* ຄົ້ນຫາ → ກັບໄປໜ້າ 1 ສະເໝີ (ບໍ່ສົ່ງ page ຕໍ່) */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        {filters}
        <form className="flex flex-1 items-center gap-2">
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          {Object.entries(hidden).map(([name, value]) =>
            value ? <input key={name} type="hidden" name={name} value={value} /> : null,
          )}
          <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
            <Search className="size-3.5 shrink-0 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder={searchPlaceholder}
              className="w-full text-xs outline-none"
            />
          </div>
          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
        </form>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ minWidth }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="w-12 px-3 py-2.5 text-center font-semibold">#</th>
                {columns.map((column) =>
                  column.key ? (
                    <SortHeader
                      key={column.key}
                      label={column.label}
                      sortKey={column.key}
                      current={sort}
                      dir={dir}
                      href={sortHref}
                      defaultDir={column.defaultDir ?? "asc"}
                      className={`py-2.5 ${column.className ?? ""}`}
                    />
                  ) : (
                    <th
                      key={column.label}
                      className={`whitespace-nowrap px-3 py-2.5 font-semibold ${column.className ?? ""}`}
                    >
                      {column.label}
                    </th>
                  ),
                )}
                {actions && <th className="px-3 py-2.5" />}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>

        {total === 0 && <p className="py-12 text-center text-xs text-slate-400">{empty}</p>}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-500">
            ສະແດງ {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} ຈາກ {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
              ກ່ອນໜ້າ
            </Link>
            <span className="px-3 font-medium text-slate-700">
              {page} / {pages}
            </span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              ຕໍ່ໄປ
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}

/* ─────────────────────── ຕົວຊ່ວຍຝັ່ງ server (ໃຊ້ໃນ page.tsx) ─────────────────────── */

/** ຈຳນວນໜ້າ — ຢ່າງໜ້ອຍ 1 ໜ້າ ເຖິງວ່າຈະບໍ່ມີຂໍ້ມູນ */
export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));
