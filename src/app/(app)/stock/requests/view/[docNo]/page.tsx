import { PrintButton } from "@/components/print-button";
import { getSession } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { canViewAssignedJob } from "@/lib/scope";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";
import { ArrowLeft, Boxes, CheckCircle2, Clock3, FileText, ShoppingCart, User, Warehouse } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * ໃບຂໍເບີກອາໄຫຼ່ SIO — ໜ້າດຽວ 2 ໂໝດ (ອອກແບບໃໝ່ 04-08-2026):
 *   ① **ໜ້າຈໍ** (`print:hidden`) — UI ແບບ card ທັນສະໄໝ ອ່ານງ່າຍທັງມືຖື/ຈໍໃຫຍ່
 *      ມີປ້າຍສະຖານະໃບ (ລໍຖ້າສາງເບີກ / ກຳລັງສັ່ງຊື້ / ເບີກບາງສ່ວນ / ເບີກຄົບແລ້ວ)
 *   ② **ພິມ** (`hidden print:block`) — ຟອມເອກະສານທາງການ A4: ຫົວບໍລິສັດ → ຂໍ້ມູນງານ →
 *      ຕາຕະລາງອາໄຫຼ່ (ມີຖັນສະຖານະ) → ຊ່ອງເຊັນ 3 ຝ່າຍ.
 * ສະຖານະໃບນິຍາມດຽວກັບຄິວກຳລັງເບີກອາໄຫຼ່: ແຖວ status=5 ບໍ່ຖືເປັນ "ກຳລັງສັ່ງຊື້"
 * ອີກ ຖ້າ ERP ຢືນຢັນຮັບເຂົ້າສາງແລ້ວ (spare_arrive) — ບໍ່ດັ່ງນັ້ນໃບຈະຄ້າຍປ້າຍສັ່ງຊື້.
 */

type Props = {
  params: Promise<{ docNo: string }>;
  /** ໜ້າທີ່ເຂົ້າມາ (ຄິວກຳລັງເບີກ / ຮັບອາໄຫຼ່ / ໃບເບີກ…) ⇒ ປຸ່ມກັບຄືນໄປບ່ອນນັ້ນ */
  searchParams: Promise<{ from?: string }>;
};

type Head = {
  doc_no: string;
  doc_date: string | null;
  product_code: string | null;
  remark: string | null;
  wh_code: string | null;
  shelf_code: string | null;
  customer: string | null;
  tel: string | null;
  product: string | null;
  p_model: string | null;
  sn: string | null;
  issue: string | null;
  warranty: string | null;
  issue_2: string | null;
  technician: string | null;
  technician_code: string | null;
  /** ERP ຢືນຢັນຮັບເຂົ້າສາງແລ້ວ ⇒ ແຖວ status=5 ບໍ່ແມ່ນ "ກຳລັງສັ່ງຊື້" ອີກ */
  spare_arrive: Date | null;
};

type Line = {
  rnum: number;
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  status: number;
};

type Company = { name_1: string | null; name_2: string | null; address: string | null; tel: string | null };
type Dispatch = { doc_no: string; doc_date: string | null };

/** ຊື່ສາງ/ບ່ອນເກັບຈາກ ERP — ລົ້ມໄດ້ບໍ່ຕາຍ (ສະແດງລະຫັດແທນ) */
async function whShelfName(whCode: string | null, shelfCode: string | null) {
  if (!whCode) return null;
  try {
    const [wh, shelf] = await Promise.all([
      queryOdg<{ name_1: string }>("select name_1 from ic_warehouse where code=$1 limit 1", [whCode]),
      shelfCode
        ? queryOdg<{ name_1: string }>("select name_1 from ic_shelf where code=$1 limit 1", [shelfCode])
        : Promise.resolve({ rows: [] as { name_1: string }[] }),
    ]);
    const whName = wh.rows[0]?.name_1 ?? whCode;
    const shelfName = shelf.rows[0]?.name_1 ?? shelfCode ?? "";
    return shelfName ? `${whName} / ${shelfName}` : whName;
  } catch {
    return shelfCode ? `${whCode} / ${shelfCode}` : whCode;
  }
}

export default async function ShowRequestBillPage({ params, searchParams }: Props) {
  const { docNo } = await params;
  const code = decodeURIComponent(docNo);
  const session = await getSession();
  if (!session) redirect("/login");

  const dict = await getDictionary(await getLocale());
  const t = dict.requestsView;
  const back = dict.docChrome;
  // ຮັບແຕ່ path ພາຍໃນເວັບ (ຂຶ້ນຕົ້ນ /) — ກັນຖືກແຊກ URL ພາຍນອກໃສ່ປຸ່ມກັບຄືນ
  const from = (await searchParams).from;
  const backHref = from?.startsWith("/") ? from : "/stock/requests";

  const head = await query<Head>(
    `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, a.product_code, a.remark,
       a.wh_code, a.shelf_code,
       b.name_1 customer, b.tel, c.name_1 product, c.p_model, c.sn, c.issue,
       a.wanrunty warranty, a.isue_2 issue_2, coalesce(d.name_1, c.emp_code) technician, c.emp_code technician_code,
       c.spare_arrive
     from ic_trans a
     left join ar_customer b on b.code = a.cust_code
     left join tb_product c on c.code = a.product_code
     left join tb_techemp d on d.code = c.emp_code
     where a.doc_no = $1 and a.trans_flag = $2`,
    [code, TRANS.REQUEST],
  );
  const bill = head.rows[0];
  if (!bill) notFound();
  if (!canViewAssignedJob(session, bill.technician_code)) redirect("/forbidden");

  const [lines, company, dispatches, whShelf] = await Promise.all([
    query<Line>(
      `select row_number() over (order by roworder)::int rnum, item_code, item_name,
          qty::text qty, unit_code, coalesce(status,0)::int status
        from ic_trans_detail where doc_no = $1 and trans_flag = $2
        order by roworder`,
      [code, TRANS.REQUEST],
    ).then((result) => result.rows),
    query<Company>("select name_1, name_2, address, tel from company_profile limit 1").then(
      (result) => result.rows[0] ?? null,
    ),
    /** ໃບເບີກ (SWC) ທີ່ສາງອອກໃຫ້ໃບຂໍນີ້ແລ້ວ — sync ຈາກ ERP ມາໄວ້ໃນ ODS (56) */
    query<Dispatch>(
      `select doc_no, to_char(doc_date,'DD-MM-YYYY') doc_date
         from ic_trans
        where trans_flag = $1 and split_part(trim(coalesce(doc_ref,'')),' ',1) = $2
        order by doc_date`,
      [TRANS.DISPATCH, code],
    ).then((result) => result.rows),
    whShelfName(bill.wh_code, bill.shelf_code),
  ]);

  const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
  const hasPurchasing = lines.some((line) => line.status === LINE_STATUS.ON_PURCHASE_ORDER);
  const hasIssued = lines.some((line) => line.status === LINE_STATUS.ISSUED);
  const allIssued = lines.length > 0 && lines.every((line) => line.status === LINE_STATUS.ISSUED);

  /** ສະຖານະລວມຂອງໃບ — ນິຍາມດຽວກັບປ້າຍໃນຄິວກຳລັງເບີກອາໄຫຼ່ (request_status) */
  const docStatus = allIssued
    ? { label: t.statusIssued, chip: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 }
    : hasPurchasing && !bill.spare_arrive
      ? { label: t.statusPurchasing, chip: "bg-violet-50 text-violet-700", icon: ShoppingCart }
      : hasIssued
        ? { label: `${t.statusIssued} ${totalQty}/${lines.length}`, chip: "bg-sky-50 text-sky-700", icon: Boxes }
        : { label: t.statusWaiting, chip: "bg-amber-50 text-amber-700", icon: Clock3 };

  const lineStatus = (status: number) =>
    status === LINE_STATUS.ISSUED
      ? { label: t.statusIssued, chip: "bg-emerald-50 text-emerald-700", print: "text-emerald-700" }
      : status === LINE_STATUS.ON_PURCHASE_ORDER && !bill.spare_arrive
        ? { label: t.statusPurchasing, chip: "bg-violet-50 text-violet-700", print: "text-violet-700" }
        : { label: t.statusWaiting, chip: "bg-amber-50 text-amber-700", print: "text-amber-700" };

  const StatusIcon = docStatus.icon;

  return (
    <>
      <style>{`@media print { @page { size: A4; margin: 12mm } }`}</style>

      {/* ════════════════ ① ໜ້າຈໍ — UI ແບບ card ════════════════ */}
      <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-8 print:hidden">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800"
        >
          <ArrowLeft className="size-3.5" />
          {back.back}
        </Link>

        {/* ຫົວໃບ: ເລກທີ · ວັນທີ · ສະຖານະ · ປຸ່ມພິມ */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-teal-600 text-white shadow-sm">
                <FileText className="size-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-800">{t.formTitle}</h1>
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                    {bill.doc_no}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.date} {bill.doc_date ?? "-"}
                  {bill.product_code && <> · {t.jobNo} <b className="font-mono">{bill.product_code}</b></>}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${docStatus.chip}`}>
                <StatusIcon className="size-3.5" />
                {docStatus.label}
              </span>
              <PrintButton label={t.pressToPrint} />
            </div>
          </div>
          {dispatches.length > 0 && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              {t.dispatchBy}{" "}
              <span className="font-mono">
                {dispatches.map((doc) => `${doc.doc_no} (${doc.doc_date ?? "-"})`).join(", ")}
              </span>
            </p>
          )}
        </section>

        {/* ຂໍ້ມູນງານ + ລູກຄ້າ/ຊ່າງ */}
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Boxes className="size-4 text-teal-600" />
              {t.jobInfo}
            </h2>
            <dl className="space-y-1.5 text-sm">
              <InfoRow label={t.productName} value={bill.product} />
              <InfoRow label={t.model} value={bill.p_model} />
              <InfoRow label={t.serialNo} value={bill.sn} mono />
              <InfoRow label={t.warranty} value={bill.warranty} />
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-slate-400">{t.issue}</dt>
                <dd className="font-semibold text-red-600">{bill.issue || "-"}</dd>
              </div>
              <InfoRow label={t.technicianDiagnosis} value={bill.issue_2} />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <User className="size-4 text-teal-600" />
              {t.customer} {bill.customer ?? "-"}
            </h2>
            <dl className="space-y-1.5 text-sm">
              <InfoRow label="Tel" value={bill.tel} />
              <InfoRow label={t.technician} value={bill.technician} />
              {whShelf && (
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-slate-400">{t.warehouse}</dt>
                  <dd className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                    <Warehouse className="size-3.5 text-slate-400" />
                    {whShelf}
                  </dd>
                </div>
              )}
              {bill.remark?.trim() && <InfoRow label={t.remark} value={bill.remark} />}
            </dl>
          </section>
        </div>

        {/* ລາຍການອາໄຫຼ່ */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Boxes className="size-4 text-teal-600" />
              {t.sparesTitle}
            </h2>
            <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
              {t.total} {lines.length} {t.lines} · {totalQty}
            </span>
          </div>
          {lines.map((line) => {
            const status = lineStatus(line.status);
            return (
              <div key={line.rnum} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">
                  {line.rnum}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{line.item_name ?? "-"}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">{line.item_code}</p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-slate-700">
                  {Number(line.qty)} <span className="text-xs font-normal text-slate-400">{line.unit_code ?? ""}</span>
                </span>
                <span className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${status.chip}`}>{status.label}</span>
              </div>
            );
          })}
        </section>
      </div>

      {/* ════════════════ ② ໃບພິມ — ຟອມເອກະສານທາງການ A4 ════════════════ */}
      <div className="hidden text-slate-950 print:block">
        {/* ── ຫົວເອກະສານ: ບໍລິສັດ · ຊື່ຟອມ · ເລກທີ/ວັນທີ ── */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-4">
          <div className="text-xs leading-5">
            <p className="text-base font-bold">{company?.name_1}</p>
            <p>{company?.name_2}</p>
            <p>{company?.address}</p>
            <p>{company?.tel}</p>
          </div>
          <div className="text-right text-sm">
            <p>
              {t.requestNo} <b className="font-mono">{bill.doc_no}</b>
            </p>
            <p>
              {t.date} <b>{bill.doc_date ?? "-"}</b>
            </p>
            {bill.product_code && (
              <p>
                {t.jobNo} <b className="font-mono">{bill.product_code}</b>
              </p>
            )}
          </div>
        </header>

        <h1 className="mt-4 text-center text-xl font-bold">
          {t.formTitle} <span className="text-sm font-normal">({t.englishTitle})</span>
        </h1>

        {/* ── ຂໍ້ມູນງານສ້ອມ ── */}
        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-slate-400 p-3 text-sm">
          <p className="col-span-2 font-bold">{t.jobInfo}</p>
          <p>
            {t.customer} {bill.customer ?? "-"}{bill.tel ? ` (${bill.tel})` : ""}
          </p>
          <p>
            {t.warranty} {bill.warranty ?? "-"}
          </p>
          <p>
            {t.productName} {bill.product ?? "-"}
          </p>
          <p>
            {t.model} {bill.p_model ?? "-"}
          </p>
          <p>
            {t.serialNo} {bill.sn ?? "-"}
          </p>
          <p>
            {t.technician} {bill.technician ?? "-"}
          </p>
          <p className="col-span-2">
            {t.issue} <span className="text-red-700">{bill.issue ?? "-"}</span>
          </p>
          <p className="col-span-2">{t.technicianDiagnosis} {bill.issue_2 ?? "-"}</p>
          {whShelf && (
            <p className="col-span-2">
              {t.warehouse} {whShelf}
            </p>
          )}
          {bill.remark?.trim() && (
            <p className="col-span-2">
              {t.remark} {bill.remark}
            </p>
          )}
        </section>

        {/* ── ຕາຕະລາງອາໄຫຼ່ ── */}
        <p className="mb-1 mt-5 font-bold">{t.sparesTitle}</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {[t.colNo, t.colCode, t.colName, t.colQty, t.colUnit, t.colStatus].map((cell) => (
                <th key={cell} className="border border-slate-900 px-2 py-1.5 font-semibold">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const status = lineStatus(line.status);
              return (
                <tr key={line.rnum}>
                  <td className="border border-slate-900 px-2 py-1.5 text-center">{line.rnum}</td>
                  <td className="border border-slate-900 px-2 py-1.5 font-mono text-xs">{line.item_code}</td>
                  <td className="border border-slate-900 px-2 py-1.5">{line.item_name ?? "-"}</td>
                  <td className="border border-slate-900 px-2 py-1.5 text-center">{Number(line.qty)}</td>
                  <td className="border border-slate-900 px-2 py-1.5 text-center">{line.unit_code ?? "-"}</td>
                  <td className={`border border-slate-900 px-2 py-1.5 text-center font-semibold ${status.print} print:text-slate-900`}>
                    {status.label}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3} className="border border-slate-900 px-2 py-1.5 text-right font-bold">
                {t.total} {lines.length} {t.lines}
              </td>
              <td className="border border-slate-900 px-2 py-1.5 text-center font-bold">{totalQty}</td>
              <td colSpan={2} className="border border-slate-900 px-2 py-1.5" />
            </tr>
          </tbody>
        </table>

        {/* ໃບເບີກ (SWC) ທີ່ສາງຈ່າຍໃຫ້ໃບຂໍນີ້ແລ້ວ — ບໍ່ມີຄືຍັງລໍຖ້າສາງເບີກ */}
        {dispatches.length > 0 && (
          <p className="mt-2 text-xs text-slate-600">
            {t.dispatchBy}{" "}
            <span className="font-mono font-semibold">
              {dispatches.map((doc) => `${doc.doc_no} (${doc.doc_date ?? "-"})`).join(", ")}
            </span>
          </p>
        )}

        {/* ── ຊ່ອງເຊັນ 3 ຝ່າຍ ── */}
        <div className="mt-16 grid grid-cols-3 gap-6 text-center text-sm">
          {[
            { label: `${t.requester} (${t.technician})`, name: bill.technician ?? "" },
            { label: t.issuer, name: "" },
            { label: t.approver, name: "" },
          ].map((role) => (
            <div key={role.label}>
              <p>{role.label}</p>
              <p className="mt-12 border-t border-slate-900 pt-1">{role.name || "(.......................................)"}</p>
              <p className="mt-1 text-xs">{t.signDate} ......./......./...........</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-slate-400">{label}</dt>
      <dd className={`font-semibold text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{value || "-"}</dd>
    </div>
  );
}
