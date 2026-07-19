import { closeJob } from "@/app/actions/installation";
import { FeedbackQrButton } from "@/components/installation/feedback-qr";
import { JobButton } from "@/components/installation/job-buttons";
import { RowLink } from "@/components/row-link";
import { query } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { installStageIs } from "@/lib/install-stage";
import { feedbackUrl } from "@/lib/track";
import { ClipboardList } from "lucide-react";
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
  SearchBar,
  TableShell,
  fetchInstallRows,
  installOrderBy,
  readParams,
  type InstallRow,
  type ListSearchParams,
} from "../shared";

/**
 * ຖອດແບບຈາກ ods: /pending_success + /pending_success_new + /close_pending_success
 * + /save_cust_complain_new (install_admin.py) — ອອກແບບໃໝ່.
 *
 * ods /pending_success_new ໃສ່ຊ່ວງວັນທີແບບ hardcode ໄວ້ (2026-05-01..2026-05-31)
 * — ບ່ອນນີ້ປ່ຽນເປັນຕົວກອງຊ່ວງວັນທີໃຫ້ຜູ້ໃຊ້ເລືອກເອງ (ຖ້າບໍ່ເລືອກ = ທັງໝົດ).
 */
export const dynamic = "force-dynamic";

/**
 * ── ຖອດແທັບ "ປິດງານຕິດຕັ້ງສຳເລັດ" ອອກ (13-07-2026) ──
 * ມັນມີ **6,819 ງານ** ⇒ ນັບ ແລະ ດຶງທຸກເທື່ອທີ່ເປີດໜ້າ ໃນຂະນະທີ່ໜ້ານີ້ມີໄວ້ **ປິດງານ**
 * (ຄິວທີ່ຍັງຄ້າງ) ບໍ່ແມ່ນເບິ່ງປະຫວັດ ⇒ ໜ້າຊ້າໂດຍບໍ່ຈຳເປັນ.
 * ງານທີ່ປິດແລ້ວເບິ່ງໄດ້: ຄົ້ນຫາ · /installations/<ລະຫັດ> · ລາຍງານງານຕິດຕັ້ງ · KPI.
 */
type Queue = "feedback" | "close";
type Row = InstallRow & { feedback: FeedbackAnswer[] | null };
export type CloseQueueProps = { searchParams: Promise<ListSearchParams & { from?: string; to?: string }> };

/** ຂັ້ນ 7 = ລໍລູກຄ້າປະເມີນ · 8 = ລໍປິດງານ · 9 = ປິດແລ້ວ */
const BUCKET: Record<Queue, { where: string; timeCol: string }> = {
  feedback: { where: installStageIs(7), timeCol: "a.qc_finish" },
  close: { where: installStageIs(8), timeCol: "a.complain_finish" },
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** ຄຳຕອບແບບສອບຖາມຂອງແຕ່ລະງານ — ເອົາມາໃຫ້ປຸ່ມແກ້ໄຂຄຳຕິຊົມ */
const FEEDBACK_JSON = `(select json_agg(json_build_object('line', cc.line_number, 'points', cc.points)
    order by cc.line_number)
  from cust_complain cc where cc.product_code = a.code and cc.topic_code = '002') feedback`;

const timeLabels = (t: Record<string, string>): Record<Queue, string> => ({
  feedback: t.timeInstallFinish,
  close: t.timeComplain,
});

export async function InstallationCloseQueue({ searchParams, queue }: CloseQueueProps & { queue: Queue }) {
  const raw = await searchParams;
  const t = (await getDictionary(await getLocale())).installClose;
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
  const bucket = BUCKET[queue];
  const where = [bucket.where, ...dateParts];
  const params: (string | number)[] = [...dateParams];
  if (q) {
    params.push(`%${q}%`);
    where.push(INSTALL_SEARCH.replaceAll("$Q", `$${params.length}`));
  }

  const [jobs, topics] = await Promise.all([
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
  const feedbackLinks = new Map(
    await Promise.all(rows.map(async (row) => [row.code, await feedbackUrl(row.code)] as const)),
  );

  const pages = Math.max(1, Math.ceil(jobs.total / PAGE_SIZE));
  const basePath = queue === "feedback" ? "/installations/feedback" : "/installations/close";
  const keep = { ...(q && { q }), ...(from && { from }), ...(to && { to }) };
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    `${basePath}?${new URLSearchParams({ ...keep, sort: key, dir: nextDir })}`;
  const pageHref = (n: number) =>
    `${basePath}?${new URLSearchParams({ ...keep, sort, dir, ...(n > 1 && { page: String(n) }) })}`;

  return (
    <div className="w-full space-y-4">
      <ListHeader
        title={queue === "feedback" ? t.titleFeedback : t.titleClose}
        scope={t.scopeAll}
        total={jobs.total}
        page={page}
        pages={pages}
      />

      {/* ຊ່ວງວັນທີຕິດຕັ້ງສຳເລັດ */}
      <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        {q && <input type="hidden" name="q" value={q} />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <span className="text-xs font-medium text-slate-600">{t.installFinishDate}</span>
        <input
          type="date"
          name="from"
          defaultValue={from}
          className="h-9 rounded-lg border border-slate-300 px-2.5 text-xs outline-none"
        />
        <span className="text-xs text-slate-400">{t.to}</span>
        <input
          type="date"
          name="to"
          defaultValue={to}
          className="h-9 rounded-lg border border-slate-300 px-2.5 text-xs outline-none"
        />
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">{t.filter}</button>
        {(from || to) && (
          <Link href={basePath} className="text-xs text-slate-500 underline">
            {t.clear}
          </Link>
        )}
      </form>

      <SearchBar
        q={q}
        sort={sort}
        dir={dir}
        hidden={{ ...(from && { from }), ...(to && { to }) }}
      />

      <TableShell total={jobs.total} minWidth={1400}>
        <InstallTableHead
          columns={INSTALL_SORTABLE_COLUMNS}
          plain={[...INSTALL_PLAIN_COLUMNS, t.customerComment]}
          sort={sort}
          dir={dir}
          sortHref={sortHref}
        />
        <tbody>
          {rows.map((row) => (
            <RowLink key={row.code} href={`/installations/${encodeURIComponent(row.code)}`} className="border-b border-slate-100 hover:bg-slate-50">
              <InstallCells row={row} timeLabel={timeLabels(t)[queue]} />
              <td className="max-w-64 px-3 py-2.5">
                <span className="block truncate" title={row.complain_cust ?? ""}>
                  {row.complain_cust || "-"}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <div className="flex items-center justify-center gap-2">
                  {queue === "feedback" ? (
                    <>
                      {/* ງານຄ້າງຢູ່ຂັ້ນນີ້ຈົນກວ່າລູກຄ້າຈະຕອບ — QR ໃຫ້ສົ່ງ/ໃຫ້ລູກຄ້າສະແກນເອງ */}
                      <FeedbackQrButton code={row.code} />
                      <Link
                        href={feedbackLinks.get(row.code) ?? "#"}
                        target="_blank"
                        title={t.questionnaireTitle}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
                      >
                        <ClipboardList className="size-4" /> {t.questionnaire}
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
                      <JobButton
                        code={row.code}
                        action={closeJob}
                        tone="success"
                        className="h-8 px-3 text-xs"
                        confirmTitle={`${t.closeJob} ${row.code}?`}
                        confirmTone="warning"
                      >
                        {t.closeJob}
                      </JobButton>
                    </>
                  )}
                </div>
              </td>
            </RowLink>
          ))}
        </tbody>
      </TableShell>

      <Pager page={page} pages={pages} total={jobs.total} pageHref={pageHref} />
    </div>
  );
}

export default function ClosePage(props: CloseQueueProps) {
  return <InstallationCloseQueue {...props} queue="close" />;
}
