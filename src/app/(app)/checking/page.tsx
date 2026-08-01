import { StartCheckButton, UndoStartCheckButton } from "@/components/checking/check-actions";
import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { MobileCardList } from "@/components/mobile-card-list";
import { PhotoThumb } from "@/components/service/photo-thumb";
import { RowLink } from "@/components/row-link";
import { SelectField } from "@/components/select-field";
import { SortHeader, type SortDir } from "@/components/sort-header";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { type Dictionary, getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { ownJobsOnly } from "@/lib/scope";
import { SERVICE_TYPE_LABEL, SLA_SQL, slaLabel, slaState, slaTone } from "@/lib/sla";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileBarChart,
  Printer,
  ReceiptText,
  Search,
  Tag,
} from "lucide-react";
import Link from "next/link";

/**
 * ຖອດແບບຈາກ ods: check.py pro_cheching() + templates/checking/homecheck.html
 *
 * ── ໜ້າຕາ: ຕາມ **ໜ້າ CS** (/service) ──
 * ໜ້ານີ້ກັບໜ້າ CS ຄືຕາຕະລາງໃບຮັບເຄື່ອງອັນດຽວກັນ ແຕ່ຄົນລະຂັ້ນ ⇒ ເມື່ອກ່ອນຂະໜາດຕົວອັກສອນ
 * (xs ທຽບກັບ sm) · ແຖບເຄື່ອງມື · ຮູບ · ແຖບແບ່ງໜ້າ ບໍ່ຄືກັນ ຄົນຍ້າຍລະຫວ່າງສອງໜ້າຕ້ອງປັບຕາໃໝ່.
 * ດຽວນີ້ໃຊ້ຊຸດດຽວກັນກັບ components/service-pending-table: ຂະໜາດ sm · ຮູບໜ້າປົກ (PhotoThumb) ·
 * ປ້າຍ "ເຄມ" · ຕົວກອງເປັນ SelectField · ແຖບແບ່ງໜ້າ ທຳອິດ/ສຸດທ້າຍ · ໄອຄອນພິມ+ສະຕິກເກີ.
 */

const PAGE_SIZE = 20;

type Dict = Dictionary["checking"];

type Tab = "waiting" | "progress";
type SlaFilter = "warning" | "late" | "critical" | "";
type Props = {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    page?: string;
    sort?: string;
    dir?: string;
    sla?: string;
    service?: string;
  }>;
};

/** ປະເພດບໍລິການທີ່ກອງໄດ້ — ຄືໜ້າ CS (lib/sla) */
const SERVICE_CODES = ["CI", "ST", "IH", "PS"];

type JobRow = {
  code: string;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  at_time: string | null;
  elapsed_seconds: number | null;
  issue: string | null;
  receiver: string | null;
  service_type: string | null;
  /** ຮູບໜ້າປົກ + ຈຳນວນຮູບ — ຄືໜ້າ CS (ຮັບເຄື່ອງ · ກວດເຊັກ · ສ້ອມສຳເລັດ) */
  thumb: string | null;
  photo_count: number;
  /** ງານເຄມ — ໝາຍໄວ້ (ods_claim_mark) ຫຼື ມີໃບເຄມຜູກ (ods_claim.ref_job) */
  is_claim: boolean;
};

const CUSTOMER = "left join ar_customer b on b.code = a.cust_code";
const SEARCH = `(a.code ilike $Q or a.sn ilike $Q or a.name_1 ilike $Q or a.p_brand ilike $Q
  or a.p_model ilike $Q or a.issue ilike $Q or b.name_1 ilike $Q or b.tel ilike $Q)`;

/** ຖັນທີ່ຈັດຮຽງໄດ້ — whitelist ກັນ SQL injection */
const SORT_SQL: Record<string, string> = {
  code: "a.code",
  customer: "b.name_1",
  product: "a.name_1",
  brand: "a.p_brand",
  warranty: "a.warrunty",
  elapsed: "at_col",
  receiver: "a.user_regis",
};

/**
 * ລໍຖ້າກວດເຊັກ / ກຳລັງກວດເຊັກ — ຕ່າງກັນແຕ່ເງື່ອນໄຂ ແລະ ຖັນເວລາທີ່ນັບຈາກ.
 * "ຄ້າງມາ" ນັບຈາກ time_register (ລໍຖ້າ) ຫຼື time_check (ກຳລັງກວດ).
 */
async function getJobs(
  tab: "waiting" | "progress",
  emp: string | null,
  q: string,
  page: number,
  sort: string,
  dir: SortDir,
  sla: SlaFilter,
  service: string,
) {
  const timeCol = tab === "waiting" ? "a.time_register" : "a.time_check";
  const where =
    tab === "waiting"
      ? ["a.time_check is null", "a.time_finish_check is null", "a.status = 1"]
      : ["a.time_check is not null", "a.time_finish_check is null", "a.status <> 6"];

  const params: (string | number)[] = [];
  if (emp) { params.push(emp); where.push(`a.emp_code = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(SEARCH.replaceAll("$Q", `$${params.length}`)); }
  if (service) { params.push(service); where.push(`a.service_type = $${params.length}`); }
  if (sla === "warning") where.push(`(${SLA_SQL}) is not null and extract(epoch from (localtimestamp - ${timeCol})) >= (${SLA_SQL}) * 0.75 and extract(epoch from (localtimestamp - ${timeCol})) <= (${SLA_SQL})`);
  if (sla === "late") where.push(`(${SLA_SQL}) is not null and extract(epoch from (localtimestamp - ${timeCol})) > (${SLA_SQL})`);
  if (sla === "critical") where.push(`(${SLA_SQL}) is not null and extract(epoch from (localtimestamp - ${timeCol})) > (${SLA_SQL}) * 2`);
  const filter = where.join(" and ");

  // at_col = ຖັນເວລາຂອງແທັບນີ້ — ໃຫ້ຈັດຮຽງ "ຄ້າງມາ" ໄດ້ (ເກົ່າກວ່າ = ຄ້າງດົນກວ່າ)
  const orderBy = `${SORT_SQL[sort] === "at_col" ? timeCol : (SORT_SQL[sort] ?? timeCol)} ${
    // ຄ້າງດົນສຸດກ່ອນ = ເວລາເກົ່າສຸດກ່ອນ ຈຶ່ງກັບທິດໃຫ້
    SORT_SQL[sort] === "at_col" || !SORT_SQL[sort] ? (dir === "desc" ? "asc" : "desc") : dir === "asc" ? "asc" : "desc"
  }`;

  const rowsSql = `select a.code,
      concat_ws('-', b.name_1, b.tel) customer, a.name_1 product, a.p_model model, a.sn, a.p_brand brand,
      a.warrunty warranty, to_char(${timeCol},'DD-MM-YYYY HH24:MI') at_time,
      greatest(0, round(extract(epoch from (localtimestamp - ${timeCol}))))::int elapsed_seconds,
      a.issue, a.user_regis receiver, a.service_type,
      -- ຮູບ + ປ້າຍເຄມ: ຊຸດຍ່ອຍອັນດຽວກັບໜ້າ CS (/service) ⇒ ສອງໜ້າສະແດງຄືກັນ
      (select product_url from product_image i
        where i.iteme_code = a.code and coalesce(i.product_url,'') <> ''
        order by line_number limit 1) as thumb,
      (
        (select count(*) from product_image i
          where i.iteme_code = a.code and coalesce(i.product_url,'') <> '')
        + (select count(*) from ods_job_photo p
            where p.workflow='repair' and p.job_code = a.code and p.kind in ('check','finish'))
      )::int as photo_count,
      (exists(select 1 from ods_claim_mark m where m.job_code = a.code)
        or exists(select 1 from ods_claim cl where cl.ref_job = a.code)) as is_claim
    from tb_product a ${CUSTOMER}
    where ${filter}
    order by ${orderBy}
    limit $${params.length + 1} offset $${params.length + 2}`;

  // ນັບລາຍການທີ່ໃຊ້ເວລາເກີນກຳນົດ (SLA) — ນັບຢູ່ DB ຈຶ່ງນັບໄດ້ທຸກໜ້າ ບໍ່ແມ່ນແຕ່ໜ້າປັດຈຸບັນ
  const countSql = `select count(*)::int total,
      count(*) filter (
        where ${SLA_SQL} is not null
          and extract(epoch from (localtimestamp - ${timeCol})) > ${SLA_SQL}
      )::int late
    from tb_product a ${CUSTOMER} where ${filter}`;

  const [rows, stats] = await Promise.all([
    query<JobRow>(rowsSql, [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
    query<{ total: number; late: number }>(countSql, params),
  ]);
  return { rows: rows.rows, total: stats.rows[0]?.total ?? 0, late: stats.rows[0]?.late ?? 0 };
}

/** ນັບຫົວແທັບ — ບໍ່ດຶງແຖວ */
async function getCounts(emp: string | null) {
  const scope = emp ? "and a.emp_code = $1" : "";
  const sql = `select
      count(*) filter (where a.time_check is null and a.time_finish_check is null and a.status = 1)::int waiting,
      count(*) filter (where a.time_check is not null and a.time_finish_check is null and a.status <> 6)::int progress
    from tb_product a where true ${scope}`;
  const row = (await query<{ waiting: number; progress: number }>(sql, emp ? [emp] : [])).rows[0];
  return { waiting: row?.waiting ?? 0, progress: row?.progress ?? 0 };
}

const JOB_COLUMNS: { key: string; labelKey: keyof Dict; defaultDir: SortDir }[] = [
  { key: "code", labelKey: "colCode", defaultDir: "desc" },
  { key: "elapsed", labelKey: "colElapsed", defaultDir: "desc" },
  { key: "product", labelKey: "colProductSn", defaultDir: "asc" },
  { key: "brand", labelKey: "colBrand", defaultDir: "asc" },
  { key: "customer", labelKey: "colCustomer", defaultDir: "asc" },
  { key: "warranty", labelKey: "colWarranty", defaultDir: "asc" },
  { key: "receiver", labelKey: "colReceiver", defaultDir: "asc" },
];

export default async function CheckingPage({ searchParams }: Props) {
  const session = await getSession();
  const dictionary = await getDictionary(await getLocale());
  const t = dictionary.checking;
  // ໄອຄອນພິມ/ສະຕິກເກີ ໃຊ້ຄຳດຽວກັບຕາຕະລາງໜ້າ CS ⇒ ບໍ່ຕ້ອງແປສອງບ່ອນ
  const tt = dictionary.servicePendingTable;
  // ຊ່າງເຫັນສະເພາະວຽກຕົນເອງ · ຜູ້ຈັດການ ແລະ ຄົນອື່ນເຫັນທຸກວຽກ
  const emp = ownJobsOnly(session);

  const params = await searchParams;
  const tab: Tab = params.tab === "progress" ? "progress" : "waiting";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";
  const sort = (params.sort ?? "elapsed").trim();
  const sla: SlaFilter = params.sla === "warning" || params.sla === "late" || params.sla === "critical" ? params.sla : "";
  const service = SERVICE_CODES.includes(params.service ?? "") ? (params.service as string) : "";

  const [counts, jobs] = await Promise.all([getCounts(emp), getJobs(tab, emp, q, page, sort, dir, sla, service)]);

  const total = jobs.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** ຄ່າທີ່ຕ້ອງພາໄປນຳທຸກລິ້ງ — ຄືໜ້າ CS (ບໍ່ດັ່ງນັ້ນກົດຈັດຮຽງແລ້ວຕົວກອງຫຼຸດ) */
  const base = () => ({
    ...(tab !== "waiting" && { tab }),
    ...(q && { q }),
    ...(sla && { sla }),
    ...(service && { service }),
  });
  // ປ່ຽນແທັບ = ຮັກສາຄຳຄົ້ນຫາ/ຕົວກອງ ແຕ່ກັບໄປໜ້າ 1 (ຄືໜ້າ CS)
  const tabHref = (target: Tab) =>
    `/checking?${new URLSearchParams({
      ...(target !== "waiting" && { tab: target }),
      ...(q && { q }),
      ...(sla && { sla }),
      ...(service && { service }),
    })}`;
  const sortHref = (key: string, nextDir: SortDir) =>
    `/checking?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/checking?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: { key: Tab; label: string; icon: typeof Clock; count: number }[] = [
    { key: "waiting", label: t.tabWaiting, icon: Clock, count: counts.waiting },
    { key: "progress", label: t.tabProgress, icon: ClipboardCheck, count: counts.progress },
  ];

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-700">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {emp ? t.showOwnJobs : t.showAllJobs} · {total.toLocaleString()} {t.items} · {t.page} {page}/{pages}
          </p>
        </div>
        <Link
          href="/reports/checking"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <FileBarChart className="size-4" />
          {t.report}
          <LinkPending />
        </Link>
      </div>

      {/* ເຕືອນລາຍການທີ່ໃຊ້ເວລາເກີນກຳນົດ */}
      {jobs.late > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {t.thereAre} <b>{jobs.late}</b> {t.items} <b>{t.overTimeLimit}</b>
          </span>
          <span className="text-xs text-red-500">{t.slaNote}</span>
        </p>
      )}

      {/* ແຖບເຄື່ອງມື — ໂຄງດຽວກັບໜ້າ CS: ແທັບ · ຄົ້ນຫາ · ຕົວກອງ · ປຸ່ມຄົ້ນ */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {tab !== "waiting" && <input type="hidden" name="tab" value={tab} />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />

        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <Link
              key={key}
              href={tabHref(key)}
              className={`inline-flex h-10 items-center gap-2 border-l border-slate-300 px-3 text-sm font-medium first:border-l-0 ${
                tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-4" />
              {label}
              <span className={`rounded px-1.5 text-xs font-bold ${tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                {count}
              </span>
              <LinkPending />
            </Link>
          ))}
        </div>

        <div className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input name="q" defaultValue={q} placeholder={t.searchPlaceholder} className="w-full text-sm outline-none" />
        </div>

        {/* ກອງຕາມສະຖານະເວລາ (SLA) — ແຕ່ກ່ອນປ່ຽນໄດ້ແຕ່ຜ່ານ URL ຈາກໜ້າອື່ນ */}
        <div className="w-48">
          <SelectField
            name="sla"
            defaultValue={sla}
            placeholder={t.allSla}
            options={[
              { value: "warning", label: t.slaWarning },
              { value: "late", label: t.slaLate },
              { value: "critical", label: t.slaCritical },
            ]}
          />
        </div>

        {/* ກອງຕາມປະເພດບໍລິການ (CI/ST/IH/PS) — ຄືໜ້າ CS */}
        <div className="w-56">
          <SelectField
            name="service"
            defaultValue={service}
            placeholder={t.allServiceTypes}
            options={SERVICE_CODES.map((code) => ({ value: code, label: `${code} · ${SERVICE_TYPE_LABEL[code] ?? code}` }))}
          />
        </div>

        <button className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white">{t.search}</button>
      </form>

      {/* ຕາຕະລາງ — ເດັສທັອບ (ຮູບແບບດຽວກັບ service-pending-table) */}
      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                {JOB_COLUMNS.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={t[column.labelKey]}
                    sortKey={column.key}
                    current={sort}
                    dir={dir}
                    href={sortHref}
                    defaultDir={column.defaultDir}
                    className={column.key === "code" ? "text-center" : ""}
                  />
                ))}
                <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colServiceType}</th>
                <th className="whitespace-nowrap px-3 py-3 font-semibold">{t.colIssue}</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {jobs.rows.map((row) => {
                const state = slaState(row.elapsed_seconds, row.service_type);
                const tone = slaTone(state);
                const limit = slaLabel(row.service_type);
                const inWarranty = row.warranty === "ຮັບປະກັນ";
                return (
                  <RowLink key={row.code} href={`/service/${row.code}`} className="relative border-b border-slate-100 hover:bg-slate-50">
                    <td className="relative whitespace-nowrap px-3 py-3 text-center font-bold text-[#0536a9]">
                      {/* ແຖບສີບອກຄວາມດ່ວນ — ຄ້າງດົນເທົ່າໃດ ຍິ່ງແດງ */}
                      <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
                      <Link href={`/service/${row.code}`} className="hover:underline">{row.code}</Link>
                      {row.is_claim && (
                        <span
                          className="mt-0.5 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 ring-1 ring-amber-300"
                          title="job claim — ໝາຍ/ມີໃບເຄມ"
                        >
                          <ReceiptText className="size-2.5" /> ເຄມ
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="flex items-center gap-1.5">
                        <Elapsed
                          seconds={row.elapsed_seconds}
                          className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${tone.chip}`}
                        />
                        {state === "late" && (
                          <span className="rounded bg-red-100 px-1 text-[10px] font-bold text-red-700">{t.slaLate}</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {row.at_time}
                        {limit && <span className="ml-1 text-slate-500">· {limit}</span>}
                      </span>
                    </td>
                    <td className="max-w-72 px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        {/* ຮູບໜ້າປົກ — ກົດເປີດຮູບທັງໝົດ (ຄືໜ້າ CS) */}
                        <PhotoThumb code={row.code} thumb={row.thumb} count={row.photo_count ?? 0} />
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-slate-800" title={row.product ?? ""}>
                            {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                          </span>
                          <span className="block truncate text-xs text-slate-400">{row.sn || "-"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{row.brand || "-"}</td>
                    <td className="max-w-48 truncate px-3 py-3" title={row.customer ?? ""}>{row.customer || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.warranty || "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{row.receiver || "-"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {SERVICE_TYPE_LABEL[row.service_type ?? ""] ?? row.service_type ?? "-"}
                    </td>
                    <td className="max-w-52 truncate px-3 py-3 font-semibold text-red-600" title={row.issue ?? ""}>
                      {row.issue || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        {/* ພິມໃບຮັບເຄື່ອງ ແລະ ສະຕິກເກີ — ຊຸດໄອຄອນດຽວກັບໜ້າ CS */}
                        <Link
                          href={`/service/${row.code}/print`}
                          target="_blank"
                          title={tt.printTitle}
                          className="text-[#D35400] hover:opacity-70"
                        >
                          <Printer className="size-4" />
                        </Link>
                        <Link
                          href={`/service/${row.code}/label`}
                          target="_blank"
                          title={tt.printStickerTitle}
                          className="text-teal-600 hover:opacity-70"
                        >
                          <Tag className="size-4" />
                        </Link>
                        {tab === "waiting" ? (
                          <StartCheckButton code={row.code} />
                        ) : (
                          /* ກຳລັງກວດເຊັກ — ກົດ "ເລີ່ມກວດເຊັກ" ຜິດໃບ ຖອນຄືນໄດ້ຢູ່ນີ້ */
                          <span className="flex items-center gap-1.5">
                            <Link
                              href={`/checking/${row.code}`}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700"
                            >
                              <ClipboardCheck className="size-4" />
                              {t.continueCheck}
                              <LinkPending />
                            </Link>
                            <UndoStartCheckButton code={row.code} variant="icon" />
                          </span>
                        )}
                      </div>
                    </td>
                  </RowLink>
                );
              })}
            </tbody>
          </table>
        </div>

        {total === 0 && <p className="py-12 text-center text-sm text-slate-400">{t.noResults}</p>}
      </section>

      {/* ບັດ — ມືຖື */}
      <div className="md:hidden">
        <MobileCardList className="space-y-2">
        {jobs.rows.map((row) => {
          const state = slaState(row.elapsed_seconds, row.service_type);
          const tone = slaTone(state);
          const limit = slaLabel(row.service_type);
          const inWarranty = row.warranty === "ຮັບປະກັນ";
          return (
            <div key={row.code} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <span className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} aria-hidden />
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Link href={`/service/${row.code}`} className="text-base font-bold text-[#0536a9] hover:underline">
                    {row.code}
                  </Link>
                  {row.is_claim && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 ring-1 ring-amber-300">
                      ເຄມ
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center justify-end gap-1">
                  <Elapsed
                    seconds={row.elapsed_seconds}
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${tone.chip}`}
                  />
                  {state === "late" && (
                    <span className="rounded bg-red-100 px-1 text-[10px] font-bold text-red-700">{t.slaLate}</span>
                  )}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-slate-400">
                {row.at_time}
                {limit && <span className="ml-1 text-slate-500">· {limit}</span>}
              </p>

              <div className="mt-2 flex items-start gap-2.5">
                <PhotoThumb code={row.code} thumb={row.thumb} count={row.photo_count ?? 0} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {row.product || "-"} {row.model && <span className="text-slate-400">{row.model}</span>}
                  </p>
                  <p className="text-xs text-slate-400">SN: {row.sn || "-"} · {row.brand || "-"}</p>
                  <p className="mt-1 text-sm text-slate-600">{row.customer || "-"}</p>
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span
                  className={`rounded px-1.5 py-0.5 font-medium ${
                    inWarranty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {row.warranty || "-"}
                </span>
                <span className="text-slate-500">{SERVICE_TYPE_LABEL[row.service_type ?? ""] ?? row.service_type ?? "-"}</span>
                {row.receiver && <span className="text-slate-400">· {row.receiver}</span>}
              </div>

              {row.issue && <p className="mt-1 text-sm font-semibold text-red-600">{row.issue}</p>}

              <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                {tab === "waiting" ? (
                  <StartCheckButton code={row.code} />
                ) : (
                  /* ກຳລັງກວດເຊັກ — ກົດ "ເລີ່ມກວດເຊັກ" ຜິດໃບ ຖອນຄືນໄດ້ຢູ່ນີ້ */
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/checking/${row.code}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700"
                    >
                      <ClipboardCheck className="size-4" />
                      {t.continueCheck}
                      <LinkPending />
                    </Link>
                    <UndoStartCheckButton code={row.code} variant="icon" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </MobileCardList>
        {total === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-400">{t.noResults}</p>
        )}
      </div>

      {/* ແບ່ງໜ້າ — ຊຸດປຸ່ມດຽວກັບໜ້າ CS (ທຳອິດ · ກ່ອນ · ໜ້າ · ຕໍ່ໄປ · ສຸດທ້າຍ) */}
      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">
            {t.showing} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.of} {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={pageHref(1)}
              aria-disabled={page === 1}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.first}
            </Link>
            <Link
              href={pageHref(page - 1)}
              aria-disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              {t.prev}
              <LinkPending />
            </Link>
            <span className="px-3 py-2 font-medium text-slate-700">{page} / {pages}</span>
            <Link
              href={pageHref(page + 1)}
              aria-disabled={page >= pages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.next}
              <LinkPending />
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href={pageHref(pages)}
              aria-disabled={page >= pages}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
            >
              {t.last}
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
