import type { ApprovedQuote, CartRow, QuoteLine } from "@/app/actions/return";
import { Card, Table } from "@/components/ui";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { CheckCircle2, FileText, TriangleAlert } from "lucide-react";
import Link from "next/link";

/**
 * ໃບຮັບເງິນອີງລາຄາຂອງໃບສະເໜີລາຄາທີ່ລູກຄ້າຕົກລົງແລ້ວ (GAP ເລື່ອງເງິນ).
 *
 * ກ່ອນນີ້ຕະກ້າຖືກຕື່ມດ້ວຍລາຄາ 0 ທຸກແຖວ → ພະນັກງານພິມລາຄາຄືນເອງ (ຫຼື ລືມພິມ ⇒ ບິນຍອດ 0).
 * ດຽວນີ້ລາຄາມາຈາກໃບສະເໜີລາຄາໂດຍກົງ. ແຖວຍັງແກ້ໄຂໄດ້ຢູ່ (ຢູ່ຕາຕະລາງລຸ່ມ) ແຕ່ຖ້າແກ້
 * ໃຫ້ຕ່າງຈາກລາຄາທີ່ລູກຄ້າຕົກລົງ → ຂຶ້ນປ້າຍສີເຫຼືອງ ພ້ອມສະແດງລາຄາທີ່ສະເໜີໄວ້.
 */

const money = (value: number) =>
  value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const chip = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold";

export async function QuotationPrices({
  quote,
  lines,
  cart,
}: {
  quote: ApprovedQuote;
  lines: QuoteLine[];
  cart: CartRow[];
}) {
  const t = (await getDictionary(await getLocale())).quotationPrices;
  const byRef = new Map(cart.filter((row) => row.row_ref !== null).map((row) => [row.row_ref, row]));
  const extras = cart.filter((row) => row.row_ref === null);

  const quotedTotal = Number(quote.total_amount);
  const discount = Number(quote.total_discount);
  const billTotal = cart.reduce((sum, row) => sum + Number(row.sum_amount), 0);
  const gap = billTotal - quotedTotal;

  const changed = lines.filter((line) => {
    const row = byRef.get(line.roworder);
    return !row || Number(row.price) !== Number(line.price) || Number(row.qty) !== Number(line.qty);
  }).length;

  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <FileText className="size-4 text-slate-500" />
          {t.priceFromQuote}{" "}
          <Link
            href={`/quotations/${encodeURIComponent(quote.doc_no)}/print`}
            className="font-bold text-[#0536a9] hover:underline"
          >
            {quote.doc_no}
          </Link>
          <span className="text-xs font-normal text-slate-500">
            ({quote.doc_date} · {t.customerAgreed})
          </span>
        </span>
      }
      actions={
        changed === 0 ? (
          <span className={`${chip} bg-emerald-50 text-emerald-700`}>
            <CheckCircle2 className="size-3.5" />
            {t.matchesQuote}
          </span>
        ) : (
          <span className={`${chip} bg-amber-50 text-amber-700`}>
            <TriangleAlert className="size-3.5" />
            {t.editedPrefix} {changed} {t.itemsSuffix}
          </span>
        )
      }
    >
      <Table
        head={["#", t.colItemCode, t.colItemName, t.colQty, t.colQuotedPrice, t.colInvoicePrice, t.colStatus]}
        minWidth={900}
      >
        {lines.map((line, index) => {
          const row = byRef.get(line.roworder);
          const quotedPrice = Number(line.price);
          const price = row ? Number(row.price) : null;
          const differs = row !== undefined && (price !== quotedPrice || Number(row.qty) !== Number(line.qty));

          return (
            <tr key={line.roworder} className="border-b border-slate-100">
              <td className="px-3 py-2 text-center">{index + 1}</td>
              <td className="px-3 py-2">{line.item_code}</td>
              <td className="px-3 py-2">{line.item_name}</td>
              <td className="px-3 py-2 text-center">
                {Number(line.qty)} {line.unit_code}
              </td>
              <td className="px-3 py-2 text-right font-semibold">{money(quotedPrice)}</td>
              <td className={`px-3 py-2 text-right font-semibold ${differs ? "text-amber-700" : ""}`}>
                {price === null ? "-" : money(price)}
              </td>
              <td className="px-3 py-2">
                {!row ? (
                  <span className={`${chip} bg-amber-50 text-amber-700`}>
                    <TriangleAlert className="size-3.5" />
                    {t.removedFromInvoice}
                  </span>
                ) : differs ? (
                  <span className={`${chip} bg-amber-50 text-amber-700`}>
                    <TriangleAlert className="size-3.5" />
                    {t.priceDiffersFromQuote} ({t.quotedLabel} {money(quotedPrice)} × {Number(line.qty)})
                  </span>
                ) : (
                  <span className={`${chip} bg-emerald-50 text-emerald-700`}>
                    <CheckCircle2 className="size-3.5" />
                    {t.matches}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </Table>

      <dl className="mt-4 space-y-1 text-sm">
        {discount > 0 && (
          <div className="flex justify-end gap-3 text-slate-600">
            <dt>{t.discountInQuote}</dt>
            <dd className="w-36 text-right font-semibold">{money(discount)} {t.baht}</dd>
          </div>
        )}
        <div className="flex justify-end gap-3 text-slate-600">
          <dt>{t.quoteTotal}</dt>
          <dd className="w-36 text-right font-semibold">{money(quotedTotal)} {t.baht}</dd>
        </div>
        <div className="flex justify-end gap-3 text-slate-700">
          <dt>{t.invoiceTotal}</dt>
          <dd className="w-36 text-right font-bold">{money(billTotal)} {t.baht}</dd>
        </div>
        {Math.abs(gap) >= 0.005 && (
          <div className="flex justify-end gap-3 text-amber-700">
            <dt>{t.difference}</dt>
            <dd className="w-36 text-right font-bold">
              {gap > 0 ? "+" : ""}
              {money(gap)} {t.baht}
            </dd>
          </div>
        )}
      </dl>

      {extras.length > 0 && (
        <p className="mt-2 text-right text-xs text-slate-500">
          {t.extrasPrefix} {extras.length} {t.extrasSuffix}
        </p>
      )}
      {discount > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          {t.discountNotePrefix} {money(discount)} {t.baht} {t.discountNoteSuffix}
        </p>
      )}
    </Card>
  );
}
