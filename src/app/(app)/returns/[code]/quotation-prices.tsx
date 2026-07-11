import type { ApprovedQuote, CartRow, QuoteLine } from "@/app/actions/return";
import { Card, Table } from "@/components/ui";
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

export function QuotationPrices({
  quote,
  lines,
  cart,
}: {
  quote: ApprovedQuote;
  lines: QuoteLine[];
  cart: CartRow[];
}) {
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
          ລາຄາມາຈາກໃບສະເໜີລາຄາ{" "}
          <Link
            href={`/quotations/${encodeURIComponent(quote.doc_no)}/print`}
            className="font-bold text-[#0536a9] hover:underline"
          >
            {quote.doc_no}
          </Link>
          <span className="text-xs font-normal text-slate-500">
            ({quote.doc_date} · ລູກຄ້າຕົກລົງແລ້ວ)
          </span>
        </span>
      }
      actions={
        changed === 0 ? (
          <span className={`${chip} bg-emerald-50 text-emerald-700`}>
            <CheckCircle2 className="size-3.5" />
            ຕົງກັບໃບສະເໜີລາຄາ
          </span>
        ) : (
          <span className={`${chip} bg-amber-50 text-amber-700`}>
            <TriangleAlert className="size-3.5" />
            ແກ້ໄຂແລ້ວ {changed} ລາຍການ
          </span>
        )
      }
    >
      <Table
        head={["#", "ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ລາຄາທີ່ສະເໜີ", "ລາຄາໃນໃບຮັບເງິນ", "ສະຖານະ"]}
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
                    ຖືກລຶບອອກຈາກໃບຮັບເງິນ
                  </span>
                ) : differs ? (
                  <span className={`${chip} bg-amber-50 text-amber-700`}>
                    <TriangleAlert className="size-3.5" />
                    ລາຄາຕ່າງຈາກໃບສະເໜີລາຄາ (ສະເໜີ {money(quotedPrice)} × {Number(line.qty)})
                  </span>
                ) : (
                  <span className={`${chip} bg-emerald-50 text-emerald-700`}>
                    <CheckCircle2 className="size-3.5" />
                    ຕົງກັນ
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
            <dt>ສ່ວນຫຼຸດໃນໃບສະເໜີລາຄາ</dt>
            <dd className="w-36 text-right font-semibold">{money(discount)} ບາດ</dd>
          </div>
        )}
        <div className="flex justify-end gap-3 text-slate-600">
          <dt>ຍອດຕາມໃບສະເໜີລາຄາ</dt>
          <dd className="w-36 text-right font-semibold">{money(quotedTotal)} ບາດ</dd>
        </div>
        <div className="flex justify-end gap-3 text-slate-700">
          <dt>ຍອດໃນໃບຮັບເງິນ</dt>
          <dd className="w-36 text-right font-bold">{money(billTotal)} ບາດ</dd>
        </div>
        {Math.abs(gap) >= 0.005 && (
          <div className="flex justify-end gap-3 text-amber-700">
            <dt>ຕ່າງກັນ</dt>
            <dd className="w-36 text-right font-bold">
              {gap > 0 ? "+" : ""}
              {money(gap)} ບາດ
            </dd>
          </div>
        )}
      </dl>

      {extras.length > 0 && (
        <p className="mt-2 text-right text-xs text-slate-500">
          ມີ {extras.length} ລາຍການທີ່ພະນັກງານເພີ່ມເອງ (ບໍ່ຢູ່ໃນໃບສະເໜີລາຄາ)
        </p>
      )}
      {discount > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          ໃບສະເໜີລາຄານີ້ມີສ່ວນຫຼຸດ {money(discount)} ບາດ — ໃບຮັບເງິນບໍ່ມີຊ່ອງສ່ວນຫຼຸດ ກະລຸນາປັບລາຄາໃນແຖວໃຫ້ຕົງກັບຍອດທີ່ຕົກລົງ
        </p>
      )}
    </Card>
  );
}
