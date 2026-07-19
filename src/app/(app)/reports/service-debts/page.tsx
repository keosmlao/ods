import { MobileCardList } from "@/components/mobile-card-list";
import { PayButton } from "@/components/service/pay-button";
import { SelectField } from "@/components/select-field";
import { getSession } from "@/lib/auth";
import { permissionFor } from "@/lib/permissions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { CUST_KIND_LABEL, serviceDebts, summarize, thb, UNSET_KIND_LABEL, type CustKind } from "@/lib/service-money";
import { AlertTriangle, Banknote } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * **ຕິດຕາມການຊຳລະ / ຄ້າງຊຳລະ ຄ່າສ້ອມ.**
 *
 * ── ຍອດມາຈາກໃສ ──
 * ໜີ້ = ໃບສະເໜີລາຄາທີ່ **ລູກຄ້າຕົກລົງແລ້ວ** (ic_trans trans_flag=17 · aprove_status=1
 * ແລະ aprove_status_2=1) ລົບ ການຊຳລະທີ່ບັນທຶກໄວ້ (ods_service_payment).
 * ໃບຮັບເງິນເກົ່າ (trans_flag=44, SIN) **ໃຊ້ບໍ່ໄດ້** — 4,456 ໃບ ຍອດ 0.00 ທຸກໃບ.
 *
 * ⚠️ ງານກ່ອນ 17-07-2026 ບໍ່ມີບັນທຶກການຈ່າຍ (ລະບົບບໍ່ເຄີຍເກັບ) ⇒ ຂຶ້ນເປັນ "ຄ້າງ" ໝົດ
 * ເຖິງແມ່ນສ່ວນຫຼາຍຈ່າຍສົດຕອນຮັບເຄື່ອງໄປແລ້ວ. ບອກໄວ້ຢູ່ໜ້າ ບໍ່ໃຫ້ຄົນເຂົ້າໃຈຜິດ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ kind?: string; scope?: string; page?: string }> };

/**
 * ແບ່ງໜ້າ — ໜີ້ຄ້າງມີ **1,048 ແຖວ** ⇒ ເທລົງໜ້າດຽວໝົດ ໜ້າໜັກ ແລະ ເປີດຊ້າ
 * (query ໃຊ້ພຽງ 44ms · ເວລາທີ່ເສຍໄປແມ່ນການແຮນເດີ HTML 1,048 ແຖວ ບໍ່ແມ່ນຖານຂໍ້ມູນ).
 * ຍອດສະຫຼຸບຂ້າງເທິງ **ຍັງຄິດຈາກທຸກແຖວ** ບໍ່ແມ່ນສະເພາະໜ້ານີ້ — ຕົວເລກເງິນຕ້ອງເຕັມສະເໝີ.
 */
const PAGE_SIZE = 50;

type Dict = Record<string, string>;

const kindOptions = (t: Dict) => [
  { value: "", label: t.allCustomers },
  { value: "shop", label: CUST_KIND_LABEL.shop },
  { value: "general", label: CUST_KIND_LABEL.general },
  { value: "unset", label: UNSET_KIND_LABEL },
];

const scopeOptions = (t: Dict) => [
  { value: "due", label: t.scopeDue },
  { value: "all", label: t.scopeAll },
];

export default async function ServiceDebtsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permission = await permissionFor(session, "/reports/service-debts");
  if (!permission.read) redirect("/forbidden");

  const t = (await getDictionary(await getLocale())).serviceDebts;

  const params = await searchParams;
  const kind = params.kind === "shop" || params.kind === "general" || params.kind === "unset" ? params.kind : undefined;
  const scope = params.scope === "all" ? "all" : "due";

  const rows = await serviceDebts({ onlyDue: scope === "due", kind });
  const total = summarize(rows);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const today = new Date().toISOString().slice(0, 10);
  // ເຄື່ອງອອກຈາກຮ້ານໄປແລ້ວ ແຕ່ຍັງບໍ່ຈ່າຍ = ຄວາມສ່ຽງທີ່ສຸດ (ທວງຍາກ)
  const risky = rows.filter((row) => row.returned_on && Number(row.due_thb.replace(/,/g, "")) > 0);

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    if (kind) next.set("kind", kind);
    next.set("scope", scope);
    next.set("page", String(target));
    return `/reports/service-debts?${next}`;
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">{t.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t.subtitle}
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <SelectField name="kind" options={kindOptions(t)} defaultValue={kind ?? ""} placeholder={t.allCustomers} />
          </div>
          <div className="w-52">
            <SelectField name="scope" options={scopeOptions(t)} defaultValue={scope} />
          </div>
          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {t.filter}
          </button>
        </form>
      </div>

      {/* ຄວາມຈິງທີ່ຕ້ອງບອກ — ບໍ່ດັ່ງນັ້ນຄົນຈະຄິດວ່າລູກຄ້າຄ້າງ 3 ລ້ານແທ້ */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-800">
          {t.noticePrefix}<b>{t.noticeStarted}</b> {t.noticeBody}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: t.statJobs, value: total.jobs.toLocaleString(), tone: "text-slate-700" },
          { label: t.statQuoted, value: thb(total.quoted), tone: "text-slate-700" },
          { label: t.received, value: thb(total.paid), tone: "text-emerald-600" },
          { label: t.statDue, value: thb(total.due), tone: "text-red-600" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-400">{item.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {risky.length > 0 && (
        <p className="text-xs text-red-600">
          {t.riskyPrefix} <b>{risky.length}</b> {t.riskySuffix}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ໂທລະສັບ — ບັດແທນຕາຕະລາງ (ຕາຕະລາງເຕັມສະແດງແຕ່ md ຂຶ້ນໄປ) */}
        <div className="md:hidden">
          <MobileCardList className="divide-y divide-slate-100">
          {shown.map((row) => {
            const due = Number(row.due_thb.replace(/,/g, "")) || 0;
            return (
              <div key={row.job} className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/service/${row.job}`} className="font-bold text-[#0536a9] hover:underline">
                      {row.job}
                    </Link>
                    <p className="truncate text-xs text-slate-600" title={row.customer ?? ""}>
                      {row.customer ?? "-"}
                      {row.tel && <span className="text-[10px] text-slate-400"> · {row.tel}</span>}
                    </p>
                  </div>
                  {row.cust_kind ? (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        row.cust_kind === "shop" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {CUST_KIND_LABEL[row.cust_kind as CustKind]}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-slate-300">{UNSET_KIND_LABEL}</span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500" title={row.product ?? ""}>
                  {row.product ?? "-"}
                </p>
                <p className="text-[10px] text-slate-400">
                  <span className="font-mono text-slate-500">{row.quote_no ?? "-"}</span> · {row.quote_date}
                  {row.age_days !== null && ` · ${row.age_days} ${t.days}`}
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                  <div>
                    <span className="block text-[10px] text-slate-400">{t.agreed}</span>
                    {row.quoted_thb}
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">{t.received}</span>
                    <span className="text-emerald-600">{row.paid_thb}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">{t.due}</span>
                    <span className={`font-bold ${due > 0 ? "text-red-600" : "text-slate-300"}`}>{row.due_thb}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {row.returned_on ? (
                    <span className={`text-[10px] ${due > 0 ? "font-semibold text-red-600" : "text-slate-500"}`}>
                      {t.returned} {row.returned_on}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">{t.stillInShop}</span>
                  )}
                  {permission.update && due > 0 && <PayButton job={row.job} due={due} today={today} />}
                </div>
              </div>
            );
          })}
          </MobileCardList>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2.5 font-semibold">{t.colJob}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colCustomer}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colType}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colProduct}</th>
                <th className="px-3 py-2.5 font-semibold">{t.colQuote}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t.agreed}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t.received}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t.due}</th>
                <th className="px-3 py-2.5 font-semibold">{t.returned}</th>
                {permission.update && <th className="px-3 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const due = Number(row.due_thb.replace(/,/g, "")) || 0;
                return (
                  <tr key={row.job} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold">
                      <Link href={`/service/${row.job}`} className="text-[#0536a9] hover:underline">
                        {row.job}
                      </Link>
                    </td>
                    <td className="max-w-44 truncate px-3 py-2.5" title={row.customer ?? ""}>
                      {row.customer ?? "-"}
                      {row.tel && <span className="block text-[10px] text-slate-400">{row.tel}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {row.cust_kind ? (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            row.cust_kind === "shop" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {CUST_KIND_LABEL[row.cust_kind as CustKind]}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">{UNSET_KIND_LABEL}</span>
                      )}
                    </td>
                    <td className="max-w-44 truncate px-3 py-2.5 text-slate-600" title={row.product ?? ""}>
                      {row.product ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="font-mono text-[10px] text-slate-500">{row.quote_no ?? "-"}</span>
                      <span className="block text-[10px] text-slate-400">
                        {row.quote_date}
                        {row.age_days !== null && ` · ${row.age_days} ${t.days}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.quoted_thb}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600">{row.paid_thb}</td>
                    <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${due > 0 ? "text-red-600" : "text-slate-300"}`}>
                      {row.due_thb}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {row.returned_on ? (
                        <span className={due > 0 ? "font-semibold text-red-600" : "text-slate-500"}>{row.returned_on}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">{t.stillInShop}</span>
                      )}
                    </td>
                    {permission.update && (
                      <td className="px-3 py-2.5 text-center">
                        {due > 0 && <PayButton job={row.job} due={due} today={today} />}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2.5 text-xs text-slate-500">
            <span>
              {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} {t.from}{" "}
              {rows.length.toLocaleString()} {t.items}
            </span>
            <span className="flex items-center gap-1">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                  {t.prev}
                </Link>
              )}
              <span className="px-2">
                {t.pageLabel} {page}/{pages}
              </span>
              {page < pages && (
                <Link href={pageHref(page + 1)} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">
                  {t.next}
                </Link>
              )}
            </span>
          </div>
        )}

        {rows.length === 0 && (
          <p className="py-12 text-center text-xs text-slate-400">
            <Banknote className="mx-auto mb-2 size-6 text-slate-300" />
            {t.noResults}
          </p>
        )}
      </section>
    </div>
  );
}
