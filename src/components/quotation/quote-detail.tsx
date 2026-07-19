import { Card, Table } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import Image from "next/image";

/** ຫົວບິນ + ລາຍການ ຂອງໃບສະເໜີລາຄາ — ໃຊ້ຮ່ວມກັນລະຫວ່າງໜ້າອະນຸມັດພາຍໃນ ແລະ ໜ້າລູກຄ້າອະນຸມັດ */

export type DetailHead = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  issue: string | null;
  warranty: string | null;
  issue_2: string | null;
  user_regis: string | null;
  technician: string | null;
  user_created: string | null;
  product_url: string | null;
  product_code: string | null;
  approver1?: string | null;
};

export type DetailLine = {
  item_code: string;
  item_name: string;
  qty: string;
  unit_code: string | null;
  price: string;
  sum_amount: string;
};

/**
 * ຍອດເງິນຂອງຫົວບິນ (ic_trans) — ເກັບໄວ້ຢູ່ຖານຂໍ້ມູນແຕ່ໜ້າອະນຸມັດບໍ່ເຄີຍສະແດງ:
 * ຜູ້ອະນຸມັດເຫັນແຕ່ຜົນບວກຂອງແຖວ (= total_value) ຈຶ່ງ **ອະນຸມັດຕົວເລກທີ່ບໍ່ແມ່ນຕົວເລກທີ່ພິມໃສ່ໃບ**
 * ຕອນມີສ່ວນຫຼຸດ (ຂໍ້ມູນຈິງ: 12 ໃບມີສ່ວນຫຼຸດ). ດຽວນີ້ສະແດງຄົບ ພ້ອມກວດວ່າຫົວບິນກັບແຖວຕົງກັນບໍ.
 */
export type DetailTotals = {
  total_value: string;
  total_discount: string;
  vat_rate: string | null;
  total_vat_value: string | null;
  total_amount: string;
  exchange_rate: string | null;
  total_amount_2: string | null;
};

const money = (v: string | number | null) => {
  const n = Number(String(v ?? "0").replace(/,/g, ""));
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const num = (v: string | number | null) => {
  const n = Number(String(v ?? "0").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function Field({ label, value, accent }: { label: string; value: string | null | undefined; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-500">{label}:</dt>
      <dd className={accent ? "font-medium text-[#b91c1c]" : "text-slate-800"}>{value || "-"}</dd>
    </div>
  );
}

function Money({ label, value, unit, strong }: { label: string; value: number; unit: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0">
      <span className={strong ? "font-bold text-slate-700" : "text-slate-500"}>{label}</span>
      <span className={`whitespace-nowrap ${strong ? "text-sm font-bold text-[#e75555]" : "font-semibold text-slate-700"}`}>
        {money(value)} {unit}
      </span>
    </div>
  );
}

export async function QuoteDetail({
  head,
  lines,
  totals,
  actions,
  showApprover,
  banner,
}: {
  head: DetailHead;
  lines: DetailLine[];
  totals?: DetailTotals;
  actions: React.ReactNode;
  showApprover?: boolean;
  banner?: React.ReactNode;
}) {
  const t = (await getDictionary(await getLocale())).quoteDetail;
  const total = lines.reduce((sum, line) => sum + Number(line.sum_amount ?? 0), 0);

  const totalValue = totals ? num(totals.total_value) : total;
  const discount = totals ? num(totals.total_discount) : 0;
  const vat = totals ? num(totals.total_vat_value) : 0;
  const vatRate = totals ? num(totals.vat_rate) : 0;
  const totalAmount = totals ? num(totals.total_amount) : total;
  const rate = totals ? num(totals.exchange_rate) : 0;
  const kip = totals ? num(totals.total_amount_2) : 0;
  // ຫົວບິນບໍ່ຕົງກັບແຖວ = ຂໍ້ມູນເພື້ຍນ (ມີຈິງ 6 ໃບ ຈາກ ods ເກົ່າ + ເລກທີຊ້ຳ) → ຕ້ອງເຫັນ ບໍ່ແມ່ນປິດງຽບ
  const mismatch = totals !== undefined && Math.abs(totalValue - total) >= 0.01;

  return (
    <div className="w-full space-y-5">
      {banner}
      <Card title={`${t.quotation} ${head.doc_no}`}>
        {actions}

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 md:col-span-2">
            <Field label={t.checkDocNo} value={head.doc_no} />
            <Field label={t.date} value={head.doc_date} />
            <Field label={t.customer} value={head.customer} />
            <Field label={t.productName} value={head.product} />
            <Field label="Model" value={head.model} />
            <Field label="SN" value={head.sn} />
            <Field label="BRAND" value={head.brand} />
            <Field label={t.warranty} value={head.warranty} />
            <Field label={t.issue} value={head.issue} accent />
            <Field label={t.techIssue} value={head.issue_2} accent />
            <Field label={t.technician} value={head.technician} />
            <Field label={t.receiver} value={head.user_regis} />
            <Field label={t.requester} value={head.user_created} />
            {showApprover && <Field label={t.approver} value={head.approver1} />}
          </dl>

          <div className="grid place-items-start justify-center">
            {head.product_url ? (
              <a href={`/api/uploads/${encodeURIComponent(head.product_url)}`} target="_blank" rel="noreferrer">
                <Image
                  src={`/api/uploads/${encodeURIComponent(head.product_url)}`}
                  alt=""
                  width={200}
                  height={200}
                  unoptimized
                  className="size-48 rounded-lg object-cover"
                />
              </a>
            ) : (
              <span className="grid size-48 place-items-center rounded-lg bg-slate-100 text-sm text-slate-400">{t.noImage}</span>
            )}
          </div>
        </div>
      </Card>

      <Card title={t.partsUsed}>
        <Table head={[t.itemCode, t.productName, t.qty, t.unit, t.price, t.sum]} minWidth={800}>
          {lines.map((line, index) => (
            <tr key={`${line.item_code}-${index}`} className="border-b border-slate-100">
              <td className="whitespace-nowrap px-3 py-2">{line.item_code}</td>
              <td className="px-3 py-2">{line.item_name}</td>
              <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
              <td className="px-3 py-2">{line.unit_code ?? "-"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{money(line.price)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold">{money(line.sum_amount)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-400">{t.noItems}</td></tr>
          )}
          <tr className="border-t border-slate-200">
            <td colSpan={5} className="px-3 py-3 text-right font-bold">{t.rowTotal}</td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-[#e75555]">{money(total)}</td>
          </tr>
        </Table>

        {/* ຍອດຕາມຫົວບິນ — ຕົວເລກທີ່ພິມໃສ່ໃບໃຫ້ລູກຄ້າ ແລະ ທີ່ໃບຮັບເງິນຈະອີງໃສ່ */}
        <div className="mt-4 ml-auto max-w-md text-xs">
          <Money label={t.totalValueLabel} value={totalValue} unit={t.baht} />
          {discount > 0 && <Money label={t.discountLabel} value={discount} unit={t.baht} />}
          {vat > 0 && <Money label={`${t.vatLabel} ${money(vatRate)}%`} value={vat} unit={t.baht} />}
          <Money label={t.grandTotalLabel} value={totalAmount} unit={t.baht} strong />
          {rate > 0 && (
            <div className="flex items-center justify-between gap-4 py-1.5 text-slate-500">
              <span>{t.exchangeRate} {money(rate)}</span>
              <span className="whitespace-nowrap font-semibold text-slate-700">{money(kip)} {t.kip}</span>
            </div>
          )}
        </div>

        {mismatch && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-right text-[11px] font-semibold text-amber-700">
            ⚠ {t.mismatchPrefix} ({money(totalValue)}) {t.mismatchMid} ({money(total)}) {t.mismatchSuffix}
          </p>
        )}
      </Card>
    </div>
  );
}
