import { getOutstandingSpares, groupByDoc } from "@/app/(app)/approvals/cancellations/outstanding";
import { OutstandingSpares } from "@/app/(app)/approvals/cancellations/outstanding-spares";
import { getApprovedQuote, getCart, getQuoteLines, getRates, seedCart } from "@/app/actions/return";
import { Chatter } from "@/components/chatter/chatter";
import { InvoiceEditor, type Bank, type BillHead, type Service } from "@/components/return/invoice-editor";
import { PageTitle } from "@/components/ui";
import { db, queryOdg } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { notFound } from "next/navigation";
import { QuotationPrices } from "./quotation-prices";
import { ReturnWithoutInvoice } from "./return-without-invoice";

/** ຖອດແບບຈາກ ods: returnproduct.py showreturn() + templates/returnProduct/showDetail.html */

type Head = BillHead & { used_spare: number | null; status: number | null; cancel_finish: string | null };

async function getHead(code: string) {
  if (!db) throw new Error("DATABASE_URL is not configured");
  const result = await db.query<Head>(
    `select a.code, a.cust_code, b.name_1 cust_name, b.tel,
        concat_ws(',', b.address, d.name_1, c.name_1) address,
        a.name_1 product, a.p_model model, a.p_brand brand, a.sn, a.warrunty warranty,
        a.issue, a.issue_2, a.emp_code, a.p_access, a.user_regis, a.used_spare, e.product_url,
        a.status, to_char(a.cancel_finish,'DD-MM-YYYY HH24:MI') cancel_finish
     from tb_product a
     left join ar_customer b on b.code = a.cust_code
     left join province c on c.code = b.provine
     left join city d on d.code = b.city and d.province = b.provine
     left join product_image e on e.iteme_code = a.code and e.line_number = 0
     where a.code = $1`,
    [code],
  );
  return result.rows[0] ?? null;
}

/** ບັນຊີທະນາຄານ + ຄ່າບໍລິການ ຢູ່ຖານ ERP (ods ໃຊ້ getcursor2) */
async function getBanks() {
  return (
    await queryOdg<Bank>(
      `select book_number, name_1,
          (select name_1 from erp_currency where code = a.currency_code) currency,
          currency_code
       from erp_pass_book a
       where currency_code is not null
       order by name_1`,
    )
  ).rows;
}

async function getServices() {
  return (
    await queryOdg<Service>(
      `select code, name_1, unit_cost unit_code from ic_inventory where code like '9900%' order by code`,
    )
  ).rows;
}

/** ເລກບິນທີ່ຈະໄດ້ (ສະແດງເທົ່ານັ້ນ — ຕອນບັນທຶກຈະອອກເລກໃໝ່ໃນ transaction ທີ່ລັອກແລ້ວ) */
async function previewDocNo() {
  if (!db) return "";
  const client = await db.connect();
  try {
    return await nextDocNo(client, "SIN");
  } finally {
    client.release();
  }
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const head = await getHead(decodeURIComponent(code));
  if (!head) notFound();

  // ວຽກທີ່ຖືກຍົກເລີກ (GAP A): ບໍ່ຕື່ມອາໄຫຼ່ເຂົ້າຕະກ້າ — ອາໄຫຼ່ຕ້ອງກັບຄືນສາງ ບໍ່ແມ່ນຄິດເງິນລູກຄ້າ.
  // ຜູ້ໃຊ້ຕື່ມ "ຄ່າບໍລິການ" (ຄ່າກວດເຊັກ) ເອງໄດ້ ຫຼື ສົ່ງຄືນໂດຍບໍ່ອອກໃບຮັບເງິນ.
  const cancelled = head.status === 6;
  // ຂໍຍົກເລີກແຕ່ຍັງບໍ່ໄດ້ອະນຸມັດ → ຍັງສົ່ງຄືນ/ອອກໃບຮັບເງິນບໍ່ໄດ້
  const waitingApproval = cancelled && !head.cancel_finish;
  if (!cancelled) {
    // ຕື່ມອາໄຫຼ່ເຂົ້າຕະກ້າຄັ້ງທຳອິດ — idempotent, ເອີ້ນຊ້ຳກໍ່ບໍ່ຊ້ຳແຖວ
    await seedCart(head.code, head.warranty, head.used_spare);
  }

  const [cart, rates, banks, services, docNo, spares, quote] = await Promise.all([
    getCart(head.code),
    getRates(),
    getBanks(),
    getServices(),
    previewDocNo(),
    cancelled ? getOutstandingSpares(head.code) : Promise.resolve([]),
    // ວຽກຍົກເລີກ: ບໍ່ຄິດຄ່າອາໄຫຼ່ → ບໍ່ຕ້ອງດຶງໃບສະເໜີລາຄາ (ຄິດແຕ່ຄ່າກວດເຊັກ)
    cancelled ? Promise.resolve(null) : getApprovedQuote(head.code),
  ]);
  // ລາຄາໃນຕະກ້າມາຈາກໃບສະເໜີລາຄາໃບນີ້ — ສະແດງໃຫ້ເຫັນ ແລະ ປຽບທຽບແຖວຕໍ່ແຖວ
  const quoteLines = quote ? await getQuoteLines(quote.doc_no) : [];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub={cancelled ? "ສົ່ງຄືນໂດຍບໍ່ສ້ອມ · ໃບຮັບເງິນ" : "ໃບຮັບເງິນ"}>ລະລະອຽດໃບເບີກ</PageTitle>

      {cancelled && !waitingApproval && (
        <>
          <ReturnWithoutInvoice code={head.code} outstandingLines={spares.length} />
          <OutstandingSpares code={head.code} docs={groupByDoc(spares)} />
        </>
      )}

      {waitingApproval ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          ໃບຮັບເຄື່ອງນີ້ຢູ່ໃນຂັ້ນຕອນຂໍຍົກເລີກ ແລະ ຍັງບໍ່ໄດ້ຮັບການອະນຸມັດ — ຕ້ອງອະນຸມັດການຍົກເລີກກ່ອນ ຈຶ່ງສົ່ງຄືນລູກຄ້າໄດ້
        </p>
      ) : (
        <>
          {quote && quoteLines.length > 0 && (
            <QuotationPrices quote={quote} lines={quoteLines} cart={cart} />
          )}
          <InvoiceEditor
            head={head}
            cart={cart}
            rates={rates}
            banks={banks}
            services={services}
            docNo={docNo}
            today={today}
          />
        </>
      )}
      <Chatter model="tb_product" resId={head.code} />
    </div>
  );
}
