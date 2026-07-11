import { SortHeader, type SortDir } from "@/components/sort-header";
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
const COLUMNS: { key: string; label: string; defaultDir: SortDir }[] = [
  { key: "code", label: "ລະຫັດ", defaultDir: "desc" },
  { key: "registered", label: "ວັນ/ເວລາ", defaultDir: "desc" },
  { key: "customer", label: "ລູກຄ້າ", defaultDir: "asc" },
  { key: "product", label: "ຊື່ເຄືອງ / SN", defaultDir: "asc" },
  { key: "brand", label: "ຫຍີ່ຫໍ້", defaultDir: "asc" },
  { key: "technician", label: "ຊ່າງ", defaultDir: "asc" },
  { key: "receiver", label: "ຜູ້ຮັບ", defaultDir: "asc" },
];

export function ServiceTable({
  rows,
  sort,
  dir,
  sortHref,
}: {
  rows: TableRow[];
  sort: string;
  dir: SortDir;
  sortHref: (sort: string, dir: SortDir) => string;
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="py-10 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] border-collapse text-sm">
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
              <th className="whitespace-nowrap px-3 py-3 font-semibold">ອາການເບື້ອງຕົ້ນ</th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">ສະຖານະ</th>
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
                    <Link href={`/service/${row.code}/print`} target="_blank" title="ພິມ" className="inline-block text-[#D35400] hover:opacity-70">
                      <Printer className="size-4" />
                    </Link>
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
