"use client";
import { approveRqOrder, notApproveRqOrder } from "@/app/actions/purchase";
import { useConfirm } from "@/components/confirm-dialog";
import { Button, Card, Empty, ErrorBox, inputClass, labelClass, LinkButton, Table } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { Check, LoaderCircle, LogOut, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useMemo, useRef, useState } from "react";

/** ຖອດແບບຈາກ ods: templates/request_order/approve_rq_order_page.html */

export type ApproveHead = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  issue: string | null;
  issue_2: string | null;
  user_regis: string | null;
  emp_code: string | null;
  user_created: string | null;
  product_url: string | null;
  attach_url: string | null;
  product_code: string | null;
  cust_code: string | null;
  warranty: string | null;
  status_doc: string | null;
  remark: string | null;
  /** 0 = ລໍຖ້າ · 1 = ອະນຸມັດແລ້ວ · 2 = ບໍ່ອະນຸມັດ/ຖອນຄືນ */
  aprove_status: number;
  approver1: string | null;
  /** ເລກໃບສັ່ງຊື້ທີ່ອອກຈາກໃບນີ້ແລ້ວ */
  spr_no: string | null;
};

export type ApproveLine = {
  item_code: string;
  item_name: string | null;
  qty: string;
  unit_code: string | null;
  price: string;
  sum_amount: string;
};

const money = (value: string | number) =>
  Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ApproveForm({
  head,
  lines,
  docNo,
  today,
}: {
  head: ApproveHead;
  lines: ApproveLine[];
  docNo: string;
  today: string;
}) {
  const [approveState, approve, approving] = useActionState(approveRqOrder, {});
  const [rejectState, reject, rejecting] = useActionState(notApproveRqOrder, {});
  const [remark, setRemark] = useState(head.remark ?? "");
  const approveRef = useRef<HTMLFormElement>(null);
  const rejectRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();
  const t = useDict().approveForm;

  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.sum_amount), 0), [lines]);
  const busy = approving || rejecting;
  /** ຕັດສິນໄປແລ້ວ = ບໍ່ມີປຸ່ມ (ກັນການອະນຸມັດຊ້ຳ ⇒ ໃບສັ່ງຊື້ຊ້ຳ) */
  const decided = head.aprove_status !== 0;

  return (
    <div className="w-full space-y-5">
      {dialog}
      {approveState.error && <ErrorBox>{approveState.error}</ErrorBox>}
      {rejectState.error && <ErrorBox>{rejectState.error}</ErrorBox>}

      <Card>
        {decided ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                head.aprove_status === 1 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {head.aprove_status === 1
                ? `${t.decidedApproved}${head.approver1 ? ` ${t.by} ${head.approver1}` : ""}${
                    head.spr_no ? ` — ${t.poRefLabel} ${head.spr_no}` : ""
                  }`
                : t.decidedRejected}
            </p>
            <LinkButton href="/approvals/purchase-requests" tone="neutral">
              <LogOut className="size-4" />
              {t.exit}
            </LinkButton>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {/* ອະນຸມັດ — ອອກໃບສັ່ງຊື້ໃຫ້ ERP ທັນທີ ຈຶ່ງຖາມຢືນຢັນກ່ອນ */}
              <form ref={approveRef} action={approve}>
                <input type="hidden" name="doc_ref" value={head.doc_no} />
                <input type="hidden" name="doc_date" value={today} />
                <input type="hidden" name="product_code" value={head.product_code ?? ""} />
                <input type="hidden" name="remark" value={remark} />
                <Button
                  type="button"
                  tone="success"
                  disabled={busy}
                  onClick={async () => {
                    const ok = await ask({
                      title: t.approveConfirmTitle,
                      message: (
                        <>
                          {t.approveConfirmLead} <b className="text-slate-700">{docNo}</b> {t.approveConfirmTail}
                          <span className="mt-1 block text-slate-500">
                            {lines.length} {t.items} · {t.total} {money(total)}
                          </span>
                        </>
                      ),
                      confirmLabel: t.approve,
                    });
                    if (ok) approveRef.current?.requestSubmit();
                  }}
                >
                  {approving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {t.approve}
                </Button>
              </form>
              <LinkButton href="/approvals/purchase-requests" tone="neutral">
                <LogOut className="size-4" />
                {t.exit}
              </LinkButton>
            </div>

            {/* ບໍ່ອະນຸມັດ */}
            <form ref={rejectRef} action={reject}>
              <input type="hidden" name="doc_no" value={head.doc_no} />
              <Button
                type="button"
                tone="danger"
                disabled={busy}
                onClick={async () => {
                  const ok = await ask({
                    title: t.rejectConfirmTitle,
                    message: (
                      <>
                        {t.docWord} <b className="text-slate-700">{head.doc_no}</b> {t.rejectConfirmTail}
                      </>
                    ),
                    confirmLabel: t.reject,
                    cancelLabel: t.cancel,
                    tone: "danger",
                  });
                  if (ok) rejectRef.current?.requestSubmit();
                }}
              >
                {rejecting ? <LoaderCircle className="size-4 animate-spin" /> : <X className="size-4" />}
                {t.reject}
              </Button>
            </form>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={t.headTitle}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Field label={t.fieldApproveNo} value={docNo} highlight />
              <Field label={t.fieldApproveDate} value={today} highlight />
              <Field label={t.fieldReqNo} value={head.doc_no} />
              <Field label={t.fieldReqDate} value={head.doc_date} />
              <Field label={t.fieldCustomer} value={head.customer} wide />
              <Field label={t.productName} value={head.product} />
              <Field label="Model" value={head.model} />
              <Field label="SN" value={head.sn} />
              <Field label="BRAND" value={head.brand} />
              <Field label={t.fieldIssue} value={head.issue} highlight />
              <Field label={t.fieldIssue2} value={head.issue_2} highlight />
              <Field label={t.fieldReceiver} value={head.user_regis} />
              <Field label={t.fieldTech} value={head.emp_code} />
              <Field label={t.fieldStatus} value={head.status_doc} highlight />
              <Field label={t.fieldWarranty} value={head.warranty} highlight />
              <Field label={t.fieldRequester} value={head.user_created} />
            </dl>

            <div className="mt-4">
              <label className={labelClass} htmlFor="remark">{t.remark}</label>
              <input
                id="remark"
                type="text"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                className={inputClass}
              />
            </div>
          </Card>
        </div>

        <Card title={t.picturesTitle}>
          <div className="space-y-4">
            <Picture label={t.pictureDevice} url={head.product_url} />
            <Picture label={t.pictureAttach} url={head.attach_url} />
          </div>
        </Card>
      </div>

      <Card title={t.sparesTitle}>
        {lines.length === 0 ? (
          <Empty />
        ) : (
          <Table head={[t.colItemCode, t.productName, t.colQty, t.colUnit, t.colPrice, t.total]} minWidth={900}>
            {lines.map((line) => (
              <tr key={line.item_code} className="border-b border-slate-100">
                <td className="px-3 py-2">{line.item_code}</td>
                <td className="px-3 py-2">{line.item_name}</td>
                <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
                <td className="px-3 py-2 text-center">{line.unit_code}</td>
                <td className="px-3 py-2 text-right">{money(line.price)}</td>
                <td className="px-3 py-2 text-right font-semibold">{money(line.sum_amount)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td colSpan={5} className="px-3 py-3 text-right">{t.total}</td>
              <td className="px-3 py-3 text-right text-red-600">{money(total)}</td>
            </tr>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, wide, highlight }: { label: string; value: string | null; wide?: boolean; highlight?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={highlight ? "font-semibold text-amber-700" : "text-slate-800"}>{value || "-"}</dd>
    </div>
  );
}

function Picture({ label, url }: { label: string; url: string | null }) {
  const t = useDict().approveForm;
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      {url ? (
        <Image
          src={`/api/uploads/${encodeURIComponent(url)}`}
          alt={label}
          width={200}
          height={200}
          unoptimized
          className="h-48 w-full rounded-lg object-contain"
        />
      ) : (
        <div className="grid h-48 place-items-center rounded-lg bg-slate-50 text-sm text-slate-400">{t.noImage}</div>
      )}
    </div>
  );
}
