import { ApprovePoButton } from "@/app/(app)/purchase-orders/approve-po-button";
import { CancelPoButton } from "@/app/(app)/purchase-orders/cancel-po-button";
import { ApproveSprForm } from "@/components/purchase/approve-spr-form";
import { SprDangerButtons } from "@/components/purchase/spr-danger-buttons";
import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { APPROVER_SIDE, roleOf, type Role } from "@/lib/roles";
import { ERP_PURCHASE, payTermLabel } from "@/lib/stock-constants";
import { Check, ChevronRight, Printer, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/**
 * **ເອກະສານສັ່ງຊື້ 1 ໃບ — ໜ້າດຽວແບບ Odoo.**
 *
 * ຮັບໄດ້ **ສອງຮາກ** ເພາະ ERP ມີສອງທາງເກີດຂອງໃບສັ່ງຊື້:
 *   ① ຮາກ SPR — ເກີດຈາກໃບຂໍຊື້ຂອງວຽກສ້ອມ: SPR → WPRA → PO → WPOA → PUI (5 ຂັ້ນ)
 *   ② ຮາກ PO  — ອອກໃບໂດຍກົງ (ຊື້ຕຸນ/ຊື້ດ່ວນ · 60% ຂອງ PO ຈິງ): PO → WPOA → PUI (3 ຂັ້ນ)
 * ວາງເລກໃດກໍ່ໄດ້ໃນຕ່ອງໂສ້ (WPRA/PO ຂອງຮາກ SPR) ⇒ ເດັ້ງໄປໜ້າມາດຕະຖານຂອງໃບນັ້ນ.
 *
 * ຄື Odoo: statusbar ເທິງຂວາ, ປຸ່ມລົງມືປ່ຽນຕາມສະຖານະ+ສິດ, ລາຍການຢູ່ກາງ,
 * ໃບອ້າງອີງທັງໝົດຢູ່ຂ້າງ. ທຸກປຸ່ມບັນທຶກລົງ ERP ບ່ອນດຽວ ແລ້ວກັບມາໜ້ານີ້.
 */
export const dynamic = "force-dynamic";

const PURCHASE_SIDE: Role[] = ["manager", "admin", "stock"];

/** ໃບເກົ່າ doc_ref/remark ເປັນເລກ RQ ຫຼື ຂໍ້ຄວາມ — ລິ້ງສະເພາະທີ່ເປັນລະຫັດວຽກແທ້ */
const isJobCode = (value: string | null): value is string => /^(\d+|INST-\w+)$/.test(value ?? "");

const branchName = (code: string | null) =>
  code === "05" ? "ໂອດ່ຽນໄທ" : code === "00" ? "ສຳນັກງານໃຫ່ຍ" : (code ?? "-");

type Props = { params: Promise<{ docNo: string }> };

type Head = {
  doc_no: string;
  doc_date: string | null;
  doc_ref: string | null;
  branch_code: string | null;
  remark: string | null;
  supplier: string | null;
  supplier_name: string | null;
  /** ຄາດວ່າຈະມາຮອດ (send_date) · ຊ່ອງທາງຈັດສົ່ງ · ສາງທີ່ຮັບເຂົ້າ — ມີສະເພາະໃບ PO */
  send_date: string | null;
  transport_name: string | null;
  wh_name: string | null;
  currency_name: string | null;
  exchange_rate: string | null;
  vat_type: number | null;
  vat_rate: string | null;
  /** 0 = ສົດ · >0 = ຕິດໜີ້ N ວັນ (ເບິ່ງ payTermLabel) */
  credit_day: number | null;
  /** ວັນຄົບກຳນົດຈ່າຍ — ERP ຄິດເປັນ doc_date + credit_day */
  credit_date: string | null;
};

type ChainDoc = { doc_no: string; doc_date: string | null; supplier: string | null; supplier_name: string | null };

type Line = { item_code: string; item_name: string | null; unit_code: string | null; qty: string; price: string; sum_amount: string };

type Receipt = { doc_no: string; doc_date: string | null; items: number };

const HEAD_SQL = `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
    split_part(trim(coalesce(t.doc_ref,'')),' ',1) doc_ref, t.branch_code, t.remark,
    t.cust_code supplier,
    (select s.name_1 from ap_supplier s where s.code=t.cust_code limit 1) supplier_name,
    to_char(t.send_date,'DD-MM-YYYY') send_date,
    (select coalesce(nullif(tt.name_1,''), tt.code) from transport_type tt where tt.code=t.transport_code limit 1) transport_name,
    (select coalesce(nullif(w.name_1,''), w.code) from ic_warehouse w
      where w.code = (select d.wh_code from ic_trans_detail d
                       where d.doc_no=t.doc_no and d.trans_flag=$2 and coalesce(d.wh_code,'') <> '' limit 1) limit 1) wh_name,
    (select coalesce(nullif(c.name_1,''), c.code) from erp_currency c where c.code=t.currency_code limit 1) currency_name,
    t.exchange_rate::text, t.vat_type, t.vat_rate::text,
    t.credit_day, to_char(t.credit_date,'DD-MM-YYYY') credit_date
  from ic_trans t where t.doc_no=$1 and t.trans_flag=$2`;

async function headOf(docNo: string, transFlag: number): Promise<Head | null> {
  return (await queryOdg<Head>(HEAD_SQL, [docNo, transFlag])).rows[0] ?? null;
}

/**
 * ໃບອະນຸມັດ PO (WPOA) — ຜູກ**ທາງຫົວໃບ** `doc_ref` (ແຖວຂອງມັນ ref_doc_no ຫວ່າງ 100%
 * ໃນ 15,240 ແຖວ) ⇒ ຫາຄືຂັ້ນອື່ນຈະບໍ່ພົບຈັກໃບ. ເບິ່ງລາຍລະອຽດທີ່ lib/erp-purchase.
 */
async function approvalOf(poNo: string): Promise<ChainDoc | null> {
  const rows = await queryOdg<ChainDoc>(
    `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date, t.cust_code supplier,
        (select s.name_1 from ap_supplier s where s.code=t.cust_code limit 1) supplier_name
      from ic_trans t
     where t.trans_flag=$2 and split_part(trim(coalesce(t.doc_ref,'')),' ',1)=$1
     order by t.doc_no limit 1`,
    [poNo, ERP_PURCHASE.ORDER_APPROVE],
  );
  return rows.rows[0] ?? null;
}

/** ໃບຖັດໄປໃນຕ່ອງໂສ້ — ຫາຈາກ ic_trans_detail.ref_doc_no (ຫົວໃບເອົາຈາກ ic_trans) */
async function nextDoc(refNo: string, transFlag: number): Promise<ChainDoc | null> {
  const rows = await queryOdg<ChainDoc>(
    `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date, t.cust_code supplier,
        (select s.name_1 from ap_supplier s where s.code=t.cust_code limit 1) supplier_name
      from ic_trans t
     where t.trans_flag=$2
       and t.doc_no in (select d.doc_no from ic_trans_detail d where d.trans_flag=$2 and d.ref_doc_no=$1)
     order by t.doc_no limit 1`,
    [refNo, transFlag],
  );
  return rows.rows[0] ?? null;
}

async function linesOf(docNo: string, transFlag: number): Promise<Line[]> {
  return (
    await queryOdg<Line>(
      `select item_code, item_name, unit_code, qty::text, coalesce(price,0)::text price,
          coalesce(sum_amount,0)::text sum_amount
         from ic_trans_detail where doc_no=$1 and trans_flag=$2 order by line_number`,
      [docNo, transFlag],
    )
  ).rows;
}

export default async function PurchaseDocPage({ params }: Props) {
  const { docNo } = await params;
  const docId = decodeURIComponent(docNo);

  /* ── ຫາຮາກຂອງເອກະສານ ── */
  const sprHead = await headOf(docId, ERP_PURCHASE.PR_REQUEST);
  let poHead: Head | null = null;

  if (!sprHead) {
    // ວາງເລກ WPRA ມາ → ຍ້ອນຫາ SPR ຕົ້ນທາງ
    const wpraHead = await headOf(docId, ERP_PURCHASE.PR_APPROVE);
    if (wpraHead?.doc_ref?.startsWith("SPR")) redirect(`/purchase-orders/${encodeURIComponent(wpraHead.doc_ref)}`);

    poHead = await headOf(docId, ERP_PURCHASE.ORDER);
    if (!poHead) notFound();

    // PO ຂອງຕ່ອງໂສ້ SPR → ເດັ້ງໄປໜ້າຂອງ SPR (ໃບດຽວ ໜ້າດຽວ)
    const viaPo = (
      await queryOdg<{ spr: string }>(
        `select split_part(trim(coalesce(w.doc_ref,'')),' ',1) spr
           from ic_trans w
          where w.trans_flag=$2 and w.doc_ref like 'SPR%'
            and w.doc_no in (select d.ref_doc_no from ic_trans_detail d where d.doc_no=$1 and d.trans_flag=$3)
          limit 1`,
        [docId, ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.ORDER],
      )
    ).rows[0];
    if (viaPo?.spr) redirect(`/purchase-orders/${encodeURIComponent(viaPo.spr)}`);
  }

  /** ຮາກ SPR = ຕ່ອງໂສ້ເຕັມ 5 ຂັ້ນ · ຮາກ PO = ໃບອອກໂດຍກົງ 3 ຂັ້ນ */
  const rooted = sprHead ? "spr" : "po";
  const head = (sprHead ?? poHead) as Head;

  const wpra = sprHead ? await nextDoc(sprHead.doc_no, ERP_PURCHASE.PR_APPROVE) : null;
  const po: ChainDoc | null = sprHead
    ? wpra
      ? await nextDoc(wpra.doc_no, ERP_PURCHASE.ORDER)
      : null
    : { doc_no: head.doc_no, doc_date: head.doc_date, supplier: head.supplier, supplier_name: head.supplier_name };
  const wpoa = po ? await approvalOf(po.doc_no) : null;
  /**
   * ຂໍ້ມູນຈັດສົ່ງ/ເງິນ ຢູ່**ໃບ PO** (ບໍ່ແມ່ນ SPR) ⇒ ຮາກ SPR ຕ້ອງອ່ານຫົວໃບ PO ອີກເທື່ອ.
   * ຮາກ PO ໃຊ້ head ທີ່ອ່ານມາແລ້ວ — ບໍ່ຖາມຊ້ຳ.
   */
  const poHeadInfo: Head | null = rooted === "po" ? head : po ? await headOf(po.doc_no, ERP_PURCHASE.ORDER) : null;

  // ໃບຮັບເຂົ້າສາງ — ໃບດຽວຮັບຫຼາຍເທື່ອໄດ້ (ມາບໍ່ຄົບ) ⇒ ອ່ານທຸກໃບ + ນັບລາຍການ
  const receipts = po
    ? (
        await queryOdg<Receipt>(
          `select d.doc_no, to_char(min(d.doc_date),'DD-MM-YYYY') doc_date, count(distinct d.item_code)::int items
             from ic_trans_detail d where d.trans_flag=$2 and d.ref_doc_no=$1
            group by d.doc_no order by d.doc_no`,
          [po.doc_no, ERP_PURCHASE.RECEIPT],
        )
      ).rows
    : [];

  // ລາຍການ — ໃຊ້ໃບຫຼ້າສຸດຂອງຕ່ອງໂສ້ (ຈັດຊື້ອາດແກ້ລາຄາຕອນອອກ PO ໃນ ERP)
  const lines = po
    ? await linesOf(po.doc_no, ERP_PURCHASE.ORDER)
    : wpra
      ? await linesOf(wpra.doc_no, ERP_PURCHASE.PR_APPROVE)
      : await linesOf(head.doc_no, ERP_PURCHASE.PR_REQUEST);
  const total = lines.reduce((sum, line) => sum + Number(line.sum_amount), 0);

  const receivedItems = new Set<string>();
  if (po) {
    const rows = await queryOdg<{ item_code: string }>(
      `select distinct item_code from ic_trans_detail where trans_flag=$2 and ref_doc_no=$1`,
      [po.doc_no, ERP_PURCHASE.RECEIPT],
    );
    for (const row of rows.rows) receivedItems.add(row.item_code);
  }
  const fullyReceived = po !== null && lines.length > 0 && lines.every((line) => receivedItems.has(line.item_code));

  /* ── ສະຖານະ + statusbar (ຕ່າງກັນຕາມຮາກ) ── */
  const STEPS =
    rooted === "spr"
      ? ["ຂໍສະເໜີຊື້", "ອະນຸມັດແລ້ວ", "ອອກ PO ແລ້ວ", "ອະນຸມັດ PO", "ຮັບເຂົ້າສາງ"]
      : ["ໃບສັ່ງຊື້", "ອະນຸມັດ PO", "ຮັບເຂົ້າສາງ"];
  const state =
    rooted === "spr"
      ? fullyReceived ? 4 : wpoa ? 3 : po ? 2 : wpra ? 1 : 0
      : fullyReceived ? 2 : wpoa ? 1 : 0;

  const session = await getSession();
  const role = roleOf(session);
  const canApprove = APPROVER_SIDE.includes(role);
  const canPurchase = PURCHASE_SIDE.includes(role);
  const here = `/purchase-orders/${encodeURIComponent(docId)}`;

  const jobRef = rooted === "spr" ? head.doc_ref : null;

  return (
    <div className="w-full space-y-4">
      {/* ── ຫົວເອກະສານ + statusbar ແບບ Odoo ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">
            <Link href="/purchase-orders" className="hover:underline">ໃບສັ່ງຊື້</Link>
            <ChevronRight className="mx-0.5 inline size-3" />
            {head.doc_no}
          </p>
          <h1 className="text-xl font-bold text-slate-700">
            {po ? `ໃບສັ່ງຊື້ ${po.doc_no}` : `ໃບຂໍສະເໜີຊື້ ${head.doc_no}`}
          </h1>
        </div>
        {/* ພິມສົ່ງຜູ້ສະໜອງ — ມີແຕ່ເມື່ອອອກ PO ແລ້ວ (ໃບຂໍຊື້ບໍ່ໄດ້ສົ່ງໃຫ້ໃຜ) */}
        {po && (
          <Link
            href={`/purchase-orders/${encodeURIComponent(po.doc_no)}/print`}
            target="_blank"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Printer className="size-3.5" />
            ພິມ PO
          </Link>
        )}
        <ol className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-[11px] font-semibold">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`flex items-center gap-1 px-3 py-1.5 ${
                index === state
                  ? "bg-[#0536a9] text-white"
                  : index < state
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-white text-slate-400"
              }`}
            >
              {index < state && <Check className="size-3" strokeWidth={3} />}
              {label}
              {index < STEPS.length - 1 && <ChevronRight className="ml-1 size-3 opacity-40" />}
            </li>
          ))}
        </ol>
      </div>

      {/* ── ແຖບລົງມື — ປຸ່ມປ່ຽນຕາມສະຖານະ + ສິດ (ຄື Odoo action bar) ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {rooted === "spr" && state === 0 &&
          (canApprove ? (
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xs text-slate-500">ໃບຂໍຊື້ລໍອະນຸມັດ — ອະນຸມັດ = ອອກ WPRA ລົງ ERP · ປະຕິເສດ = ລຶບໃບອອກຈາກ ERP</p>
              <ApproveSprForm sprNo={head.doc_no} back={here} />
            </div>
          ) : (
            <p className="text-xs text-slate-500">ລໍຜູ້ມີສິດອະນຸມັດໃບຂໍຊື້ (WPRA)</p>
          ))}
        {rooted === "spr" && state === 1 && (
          <div className="space-y-3">
            {canPurchase ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  ອະນຸມັດແລ້ວ ({wpra?.doc_no}) — ອອກໃບສັ່ງຊື້: ເລືອກຜູ້ສະໜອງ ແລະ **ໃສ່ລາຄາ** (ໃບຂໍຊື້ບໍ່ຮູ້ລາຄາ) · ຫຼື ອອກໃນ ERP ໂດຍກົງກໍ່ໄດ້
                </p>
                {wpra && (
                  <Link
                    href={`/purchase-orders/new?from=${encodeURIComponent(wpra.doc_no)}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    <ShoppingCart className="size-3.5" />
                    ອອກ PO
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">ອະນຸມັດແລ້ວ ({wpra?.doc_no}) — ລໍຝ່າຍຈັດຊື້ອອກ PO (ເລືອກຜູ້ສະໜອງ + ໃສ່ລາຄາ)</p>
            )}
            {/**
             * ທາງອອກຂອງໃບທີ່ອະນຸມັດແລ້ວ ແຕ່ **ຍັງບໍ່ໄດ້ອອກ PO** — ກ່ອນນີ້ບໍ່ມີເລີຍ:
             * ອະນຸມັດຜິດໃບແລ້ວແກ້ບໍ່ໄດ້ ນອກຈາກເຂົ້າໄປລຶບໃນ ERP ເອງ.
             * ອອກ PO ແລ້ວປຸ່ມນີ້ຫາຍ (state ≥ 2) ⇒ ຕ້ອງຍົກເລີກ PO ກ່ອນ.
             */}
            {canApprove && (
              <div className="border-t border-slate-100 pt-3">
                <SprDangerButtons sprNo={head.doc_no} back={here} />
              </div>
            )}
          </div>
        )}
        {po && !wpoa && !fullyReceived && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-xs text-slate-500">
              ອອກ PO ແລ້ວ ({po.doc_no} · {po.supplier_name ?? po.supplier ?? "-"}) — ລໍອະນຸມັດ PO (WPOA)
            </p>
            {canApprove && <ApprovePoButton poNo={po.doc_no} back={here} />}
            {canPurchase && <CancelPoButton poNo={po.doc_no} back={here} />}
          </div>
        )}
        {wpoa && !fullyReceived && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-xs text-slate-600">
              ອະນຸມັດ PO ແລ້ວ ({wpoa.doc_no}) — ລໍຜູ້ສະໜອງສົ່ງຂອງ ແລະ ສາງຮັບເຂົ້າ (PUI) ຢູ່ ERP
              {receipts.length > 0 && ` · ຮັບແລ້ວ ${receivedItems.size}/${lines.length} ລາຍການ`}
            </p>
            {/* ຍັງບໍ່ຮັບຂອງ ⇒ ຍົກເລີກໄດ້ (ຜູ້ອະນຸມັດເທົ່ານັ້ນ ເພາະຕ້ອງລຶບໃບອະນຸມັດນຳ) */}
            {po && receipts.length === 0 && canApprove && <CancelPoButton poNo={po.doc_no} back={here} />}
          </div>
        )}
        {fullyReceived && (
          <p className="text-xs font-semibold text-emerald-700">
            ຮັບເຂົ້າສາງຄົບແລ້ວ ({receipts.map((r) => r.doc_no).join(", ")}) — ຈົບຕ່ອງໂສ້ການສັ່ງຊື້
          </p>
        )}
      </div>

      {/* ── ຂໍ້ມູນໃບ + ລາຍການ ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600">
            ລາຍການອາໄຫຼ່ ({lines.length})
            {rooted === "spr" && po ? ` — ຕາມໃບ PO ${po.doc_no}` : rooted === "spr" && wpra ? ` — ຕາມໃບອະນຸມັດ ${wpra.doc_no}` : ""}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-semibold">ອາໄຫຼ່</th>
                  <th className="px-3 py-2 text-right font-semibold">ຈຳນວນ</th>
                  <th className="px-3 py-2 font-semibold">ຫົວໜ່ວຍ</th>
                  <th className="px-3 py-2 text-right font-semibold">ລາຄາ</th>
                  <th className="px-3 py-2 text-right font-semibold">ລວມ</th>
                  {po && <th className="px-3 py-2 text-center font-semibold">ຮັບແລ້ວ</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.item_code} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2">
                      <span className="block font-medium text-slate-800">{line.item_name ?? "-"}</span>
                      <span className="block font-mono text-[10px] text-slate-400">{line.item_code}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(line.qty).toLocaleString()}</td>
                    <td className="px-3 py-2">{line.unit_code ?? "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(line.price).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{Number(line.sum_amount).toLocaleString()}</td>
                    {po && (
                      <td className="px-3 py-2 text-center">
                        {receivedItems.has(line.item_code) ? (
                          <Check className="inline size-3.5 text-emerald-600" strokeWidth={3} />
                        ) : (
                          <span className="text-[10px] text-slate-400">ລໍຂອງ</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={4} className="px-3 py-2 text-right font-semibold text-slate-600">ລວມທັງໝົດ</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{total.toLocaleString()}</td>
                  {po && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-bold text-slate-600">ຂໍ້ມູນໃບ</h2>
            <dl className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">{rooted === "spr" ? "ວັນທີຂໍຊື້" : "ວັນທີອອກໃບ"}</dt>
                <dd className="font-medium">{head.doc_date ?? "-"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">ວຽກສ້ອມ</dt>
                <dd>
                  {isJobCode(jobRef) ? (
                    <Link href={`/service/${jobRef}`} className="font-medium text-[#0536a9] hover:underline">{jobRef}</Link>
                  ) : jobRef ? (
                    // ໃບເກົ່າ doc_ref ເປັນເລກ RQ/ຂໍ້ຄວາມ — ສະແດງຕາມຕົວ ບໍ່ລິ້ງ
                    <span className="font-mono text-[11px] text-slate-500">{jobRef}</span>
                  ) : (
                    <span className="text-slate-400">ບໍ່ຜູກວຽກ (ຊື້ເຂົ້າສາງ)</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2"><dt className="text-slate-400">ສາຂາ</dt><dd className="font-medium">{branchName(head.branch_code)}</dd></div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">ຜູ້ສະໜອງ</dt>
                <dd className="max-w-44 truncate text-right font-medium" title={po?.supplier_name ?? ""}>
                  {po ? (po.supplier_name ?? po.supplier ?? "-") : <span className="text-slate-400">ເລືອກຕອນອອກ PO</span>}
                </dd>
              </div>
              {poHeadInfo && (
                <>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">ຄາດວ່າຈະມາຮອດ</dt>
                    <dd className="font-medium">{poHeadInfo.send_date ?? "-"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">ຊ່ອງທາງຈັດສົ່ງ</dt>
                    <dd className="max-w-44 truncate text-right font-medium">{poHeadInfo.transport_name ?? "-"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">ສາງທີ່ຮັບເຂົ້າ</dt>
                    <dd className="max-w-44 truncate text-right font-medium">{poHeadInfo.wh_name ?? "-"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">ສະກຸນເງິນ</dt>
                    <dd className="font-medium">
                      {poHeadInfo.currency_name ?? "-"}
                      {poHeadInfo.exchange_rate && Number(poHeadInfo.exchange_rate) !== 1 && (
                        <span className="ml-1 text-slate-400">(× {Number(poHeadInfo.exchange_rate)})</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">VAT</dt>
                    <dd className="font-medium">
                      {poHeadInfo.vat_type === 0
                        ? `ແຍກນອກ ${Number(poHeadInfo.vat_rate ?? 0)}%`
                        : `ລວມໃນລາຄາແລ້ວ ${Number(poHeadInfo.vat_rate ?? 0)}%`}
                    </dd>
                  </div>
                  {/* ສົດ/ຕິດໜີ້ — ຜູ້ອະນຸມັດຕ້ອງເຫັນກ່ອນກົດອະນຸມັດ ບໍ່ແມ່ນເຫັນຕອນໃບຮອດແລ້ວ */}
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">ການຈ່າຍເງິນ</dt>
                    <dd className="font-medium">
                      {payTermLabel(poHeadInfo.credit_day)}
                      {Boolean(poHeadInfo.credit_day) && poHeadInfo.credit_date && (
                        <span className="ml-1 text-slate-400">(ຄົບ {poHeadInfo.credit_date})</span>
                      )}
                    </dd>
                  </div>
                </>
              )}
              {head.remark && (
                <div className="flex justify-between gap-2"><dt className="text-slate-400">ໝາຍເຫດ</dt><dd className="max-w-44 text-right font-medium">{head.remark}</dd></div>
              )}
            </dl>
          </section>

          {/* ── ໃບໃນຕ່ອງໂສ້ — ຄື "linked documents" ຂອງ Odoo ── */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-bold text-slate-600">ເອກະສານໃນ ERP</h2>
            <ul className="space-y-2 text-xs">
              {(rooted === "spr"
                ? [
                    { label: "ໃບຂໍຊື້ (SPR)", doc: { doc_no: head.doc_no, doc_date: head.doc_date } },
                    { label: "ອະນຸມັດ (WPRA)", doc: wpra },
                    { label: "ໃບສັ່ງຊື້ (PO)", doc: po },
                    { label: "ອະນຸມັດ PO (WPOA)", doc: wpoa },
                  ]
                : [
                    { label: "ໃບສັ່ງຊື້ (PO)", doc: { doc_no: head.doc_no, doc_date: head.doc_date } },
                    { label: "ອະນຸມັດ PO (WPOA)", doc: wpoa },
                  ]
              ).map(({ label, doc }) => (
                <li key={label} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">{label}</span>
                  {doc ? (
                    <span className="font-mono text-[11px] font-medium text-slate-700">
                      {doc.doc_no} <span className="text-slate-400">· {doc.doc_date ?? "-"}</span>
                    </span>
                  ) : (
                    <span className="text-slate-300">ຍັງບໍ່ມີ</span>
                  )}
                </li>
              ))}
              {receipts.map((receipt) => (
                <li key={receipt.doc_no} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">ຮັບເຂົ້າສາງ (PUI)</span>
                  <span className="font-mono text-[11px] font-medium text-emerald-700">
                    {receipt.doc_no} <span className="text-slate-400">· {receipt.doc_date ?? "-"} · {receipt.items} ລາຍການ</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
