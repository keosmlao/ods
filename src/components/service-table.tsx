import { SortHeader, type SortDir } from "@/components/sort-header";
import { ServiceDeleteButton } from "@/components/service/service-delete-button";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { Printer } from "lucide-react";
import Link from "next/link";

/**
 * ວຽກທີ່ຈົບແລ້ວ/ຍົກເລີກ — ບໍ່ຂຶ້ນກະດານ ເພາະມີເປັນພັນໃບ.
 * ບໍ່ມີຖັນຮູບ: 100 ແຖວ = 100 request ໄປ /api/uploads → ໜ້າຊ້າ. ຮູບເບິ່ງໄດ້ຢູ່ໜ້າລາຍລະອຽດ.
 */
export type TableRow = {
  code: string;
  registered: string | null;
  customer: string | null;
  product: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  technician: string | null;
  receiver: string | null;
  status: string;
  /** tb_product.status = 6 ຄື ຍົກເລີກ */
  raw_status: number | null;
};

/** ຖັນທີ່ຈັດຮຽງໄດ້ (whitelist ຕົງກັບ CLOSED_SORT_SQL ຢູ່ຝັ່ງ server) */
const columnsFor = (t: Dictionary["serviceTable"]): { key: string; label: string; defaultDir: SortDir }[] => [
  { key: "code", label: t.colCode, defaultDir: "desc" },
  { key: "registered", label: t.colRegistered, defaultDir: "desc" },
  { key: "customer", label: t.colCustomer, defaultDir: "asc" },
  { key: "product", label: t.colProduct, defaultDir: "asc" },
  { key: "brand", label: t.colBrand, defaultDir: "asc" },
  { key: "technician", label: t.colTechnician, defaultDir: "asc" },
  { key: "receiver", label: t.colReceiver, defaultDir: "asc" },
];

export async function ServiceTable({
  canDelete = false,
  rows,
  sort,
  dir,
  sortHref,
}: {
  /** ຜູ້ຈັດການເທົ່ານັ້ນ */
  canDelete?: boolean;
  rows: TableRow[];
  sort: string;
  dir: SortDir;
  sortHref: (sort: string, dir: SortDir) => string;
}) {
  const t = (await getDictionary(await getLocale())).serviceTable;
  if (rows.length === 0) {
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
        <table className="w-full min-w-[1200px] border-collapse text-sm">
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
              <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colIssue}</th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colStatus}</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cancelled = row.raw_status === 6;
              return (
                <tr key={row.code} className={`border-b border-slate-100 ${cancelled ? "bg-[#F3A9A3]" : "hover:bg-slate-50"}`}>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-bold text-[#0536a9]">
                    <Link href={`/service/${row.code}`} className="hover:underline">{row.code}</Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{row.registered ?? "-"}</td>
                  <td className="px-3 py-3">{row.customer || "-"}</td>
                  <td className="px-3 py-3">
                    {row.product || "-"}
                    <span className="block text-xs text-slate-400">{row.sn || "-"}</span>
                  </td>
                  <td className="px-3 py-3">{row.brand ?? "-"}</td>
                  <td className="px-3 py-3">{row.technician ?? "-"}</td>
                  <td className="px-3 py-3">{row.receiver ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.warranty ?? "-"}</td>
                  <td className="max-w-64 truncate px-3 py-3 font-semibold text-red-600" title={row.issue ?? ""}>{row.issue ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.status}</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2.5">
                      <Link href={`/service/${row.code}/print`} target="_blank" title={t.printTitle} className="text-[#D35400] hover:opacity-70">
                        <Printer className="size-4" />
                      </Link>
                      {canDelete && <ServiceDeleteButton code={row.code} />}
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
