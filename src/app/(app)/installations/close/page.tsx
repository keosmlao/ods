import { closeJob, reopenJob } from "@/app/actions/installation";
import { UndoButton } from "@/components/checking/undo-button";
import { FeedbackQrButton } from "@/components/installation/feedback-qr";
import { JobButton } from "@/components/installation/job-buttons";
import { query } from "@/lib/db";
import { installStageIs } from "@/lib/install-stage";
import { ClipboardList, ListChecks, Lock, MessageSquare } from "lucide-react";
import Link from "next/link";
import { FeedbackEditButton, type FeedbackAnswer } from "../feedback-edit";
import {
  INSTALL_PLAIN_COLUMNS,
  INSTALL_SEARCH,
  INSTALL_SORTABLE_COLUMNS,
  InstallCells,
  InstallTableHead,
  ListHeader,
  PAGE_SIZE,
  Pager,
  TableShell,
  TabsAndSearch,
  fetchInstallRows,
  installOrderBy,
  readParams,
  type InstallRow,
  type ListSearchParams,
  type TabItem,
} from "../shared";

/**
 * ຖອດແບບຈາກ ods: /pending_success + /pending_success_new + /close_pending_success
 * + /save_cust_complain_new (install_admin.py) — ອອກແບບໃໝ່.
 *
 * ods /pending_success_new ໃສ່ຊ່ວງວັນທີແບບ hardcode ໄວ້ (2026-05-01..2026-05-31)
 * — ບ່ອນນີ້ປ່ຽນເປັນຕົວກອງຊ່ວງວັນທີໃຫ້ຜູ້ໃຊ້ເລືອກເອງ (ຖ້າບໍ່ເລືອກ = ທັງໝົດ).
 */
export const dynamic = "force-dynamic";

type Tab = "feedback" | "close" | "closed";
type Row = InstallRow & { feedback: FeedbackAnswer[] | null };
type Props = { searchParams: Promise<ListSearchParams & { from?: string; to?: string }> };

/** ຂັ້ນ 6 = ຕິດຕັ້ງສຳເລັດ (ລໍຖ້າ complain) · 7 = ລໍຖ້າປິດງານ · 8 = ປິດງານເເລ້ວ */
const BUCKET: Record<Tab, { where: string; timeCol: string }> = {
  feedback: { where: installStageIs(7), timeCol: "a.qc_finish" },
  close: { where: installStageIs(8), timeCol: "a.complain_finish" },
  closed: { where: installStageIs(9), timeCol: "a.job_finish" },
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** ຄຳຕອບແບບສອບຖາມຂອງແຕ່ລະງານ — ເອົາມາໃຫ້ປຸ່ມແກ້ໄຂຄຳຕິຊົມ */
const FEEDBACK_JSON = `(select json_agg(json_build_object('line', cc.line_number, 'points', cc.points)
    order by cc.line_number)
  from cust_complain cc where cc.product_code = a.code and cc.topic_code = '002') feedback`;

/** ໝາຍເຫດ: "close" ເປັນຄຳສະຫງວນຂອງ Postgres — ໃຊ້ເປັນຊື່ຖັນບໍ່ໄດ້ */
async function getCounts(dateWhere: string, dateParams: string[]) {
  const row = (
    await query<{ wait_feedback: number; wait_close: number; done: number }>(
      `select count(*) filter (where ${BUCKET.feedback.where})::int wait_feedback,
              count(*) filter (where ${BUCKET.close.where})::int wait_close,
              count(*) filter (where ${BUCKET.closed.where})::int done
       from ods_tb_install a where true ${dateWhere}`,
      dateParams,
    )
  ).rows[0];
  return { feedback: row?.wait_feedback ?? 0, close: row?.wait_close ?? 0, closed: row?.done ?? 0 };
}

const TIME_LABEL: Record<Tab, string> = {
  feedback: "ວັນ/ເວລາຕິດຕັ້ງສຳເລັດ",
  close: "ວັນ/ເວລາ complain",
  closed: "ວັນ/ເວລາປິດງານ",
};

export default async function ClosePage({ searchParams }: Props) {
  const raw = await searchParams;
  const tab: Tab = raw.tab === "close" || raw.tab === "closed" ? raw.tab : "feedback";
  const { q, page, sort, dir } = readParams(raw);
  const from = ISO.test(raw.from ?? "") ? (raw.from as string) : "";
  const to = ISO.test(raw.to ?? "") ? (raw.to as string) : "";

  // ຕົວກອງຊ່ວງວັນທີ ອີງໃສ່ວັນທີຕິດຕັ້ງສຳເລັດ
  const dateParams: string[] = [];
  const dateParts: string[] = [];
  if (from) {
    dateParams.push(from);
    dateParts.push(`a.finish_install::date >= $${dateParams.length}::date`);
  }
  if (to) {
    dateParams.push(to);
    dateParts.push(`a.finish_install::date <= $${dateParams.length}::date`);
  }
  const dateWhere = dateParts.length ? `and ${dateParts.join(" and ")}` : "";

  const bucket = BUCKET[tab];
  const where = [bucket.where, ...dateParts];
  const params: (string | number)[] = [...dateParams];
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const [counts, jobs, topics] = await Promise.all([
    getCounts(dateWhere, dateParams),
    fetchInstallRows({
      where: where.join(" and "),
      params,
      orderBy: installOrderBy(sort, dir, bucket.timeCol),
      page,
      extraColumns: FEEDBACK_JSON,
    }),
    query<{ line_number: number; name_1: string }>(
      "select line_number, name_1 from topic_complain where code='002' order by line_number asc",
    ),
  ]);
  const rows = jobs.rows as Row[];

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const keep = { ...(q && { q }), ...(from && { from }), ...(to && { to }) };
  const base = () => ({ ...(tab !== "feedback" && { tab }), ...keep });
  const tabHref = (target: Tab) =>
    `/installations/close?${new URLSearchParams({ ...(target !== "feedback" && { tab: target }), ...keep })}`;
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `/installations/close?${new URLSearchParams({ ...base(), sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `/installations/close?${new URLSearchParams({ ...base(), sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  const TABS: TabItem<Tab>[] = [
    { key: "feedback", label: "ລໍຖ້າລູກຄ້າ complain", icon: MessageSquare, count: counts.feedback },
    { key: "close", label: "ລໍຖ້າປິດງານຕິດຕັ້ງ", icon: Lock, count: counts.close },
    { key: "closed", label: "ປິດງານຕິດຕັ້ງສຳເລັດ", icon: ListChecks, count: counts.closed },
  ];

  return (
    <div className="w-full space-y-4">
      <ListHeader title="ປິດງານ" scope="ສະແດງທຸກງານ" total={jobs.total} page={page} pages={pages} />

      {/* ຊ່ວງວັນທີຕິດຕັ້ງສຳເລັດ */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        {tab !== "feedback" && <input type="hidden" name="tab" value={tab} />}
        {q && <input type="hidden" name="q" value={q} />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <span className="text-xs font-medium text-slate-600">ວັນທີຕິດຕັ້ງສຳເລັດ</span>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="h-9 rounded-lg border border-slate-300 px-2.5 text-xs outline-none"
        />
        <span className="text-xs text-slate-400">ຫາ</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="h-9 rounded-lg border border-slate-300 px-2.5 text-xs outline-none"
        />
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ກັ່ນຕອງ</button>
        {(from || to) && (
          <Link href="/installations/close" className="text-xs text-slate-500 underline">
            ລ້າງ
          </Link>
        )}
      </form>

      <TabsAndSearch
        tabs={TABS}
        current={tab}
        tabHref={tabHref}
        q={q}
        sort={sort}
        dir={dir}
        hidden={{ ...(tab !== "feedback" && { tab }), ...(from && { from }), ...(to && { to }) }}
      />

      <TableShell total={jobs.total} minWidth={1400}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={[...INSTALL_PLAIN_COLUMNS, "ຄຳເຫັນລູກຄ້າ"]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel={TIME_LABEL[tab]} />
              <td className="max-w-64 px-3 py-2.5">
                <span className="block truncate" title={row.complain_cust ?? ""}>
                  {row.complain_cust || "-"}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <div className="flex items-center justify-center gap-2">
                  {tab === "feedback" ? (
                    <>
                      {/* ງານຄ້າງຢູ່ຂັ້ນນີ້ຈົນກວ່າລູກຄ້າຈະຕອບ — QR ໃຫ້ສົ່ງ/ໃຫ້ລູກຄ້າສະແກນເອງ */}
                      <FeedbackQrButton code={row.code} />
                      <Link
                        href={`/feedback/${encodeURIComponent(row.code)}`}
                        target="_blank"
                        title="ແບບສອບຖາມລູກຄ້າ"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                      >
                        <ClipboardList className="size-4" /> ແບບສອບຖາມ
                      </Link>
                    </>
                  ) : (
                    <>
                      <FeedbackEditButton
                        code={row.code}
                        comment={row.complain_cust ?? ""}
                        topics={topics.rows}
                        answers={row.feedback ?? []}
                      />
                      {tab === "close" && (
                        <JobButton
                          code={row.code}
                          action={closeJob}
                          tone="success"
                          className="h-8 px-3 text-xs"
                          confirmTitle={`ປິດງານ ${row.code}?`}
                          confirmTone="warning"
                        >
                          ປິດງານ
                        </JobButton>
                      )}
                      {tab === "closed" && (
                        /* ປິດງານຜິດ → ເປີດຄືນໄປ "ລໍຖ້າປິດງານ" (ແຕ່ກ່ອນປິດແລ້ວປິດເລີຍ ແກ້ບໍ່ໄດ້) */
                        <UndoButton
                          variant="icon"
                          label="ເປີດງານຄືນ"
                          title="ເປີດງານຄືນ?"
                          message={
                            <>
                              ງານ <b className="text-slate-700">#{row.code}</b> ຈະກັບໄປ &quot;ລໍຖ້າປິດງານ&quot;.
                              ຄຳຕອບແບບສອບຖາມຂອງລູກຄ້າຍັງຢູ່ຄືເກົ່າ.
                            </>
                          }
                          action={() => reopenJob(row.code)}
                        />
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={jobs.total} pageHref={pageHref} />
    </div>
  );
}
