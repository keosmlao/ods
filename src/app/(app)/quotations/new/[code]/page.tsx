import { QuoteBuilder } from "@/components/quotation/quote-builder";
import { getDraftLinesByProduct, getKipRate, getServiceItems, previewDocNo } from "@/components/quotation/queries";
import { db, query } from "@/lib/db";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: qt.py page_qt() + templates/Qutation/create_page.html */

type Props = { params: Promise<{ code: string }> };

type HeadRow = {
  customer: string | null;
  product_name: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  issue_2: string | null;
  technician: string | null;
  product_code: string;
  product_url: string | null;
  used_spare: number | null;
  cust_code: string | null;
};

/**
 * ຄື page_qt(): ຖ້າ tb_product.used_spare=1 ແລະ ຮ່າງຍັງຫວ່າງ → ດຶງອາໄຫຼ່ທີ່ຊ່າງໃຊ້ (tb_used_spare)
 * ມາໃສ່ຮ່າງໃຫ້ອັດຕະໂນມັດ. ລັອກໄວ້ ກັນຫຼາຍ tab ໂຫລດພ້ອມກັນແລ້ວໄດ້ລາຍການຊ້ຳ.
 */
async function seedDraft(productCode: string) {
  if (!db) return;
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734218)");
    await client.query(
      `insert into ic_trans_detail_draft(product_code, item_code, item_name, qty, unit_code, price, sum_amount)
       select a.product_code, a.item_code, a.item_name, a.qty, a.unit_code,
              coalesce(b.price, 0), coalesce(b.price, 0) * a.qty
       from tb_used_spare a
       left join ic_inventory b on a.item_code = b.code
       where a.product_code = $1
         and not exists (select 1 from ic_trans_detail_draft d where d.product_code = $1 and d.doc_no is null)`,
      [productCode],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("seedDraft failed", error);
  } finally {
    client.release();
  }
}

export default async function NewQuotationPage({ params }: Props) {
  const { code } = await params;

  const head = (
    await query<HeadRow>(
      `select concat_ws('-', b.name_1, b.tel) customer, a.name_1 product_name, a.p_model model, a.sn,
          a.p_brand brand, a.warrunty warranty, a.issue, a.issue_2, a.emp_code technician,
          a.code product_code, c.product_url, a.used_spare, b.code cust_code
        from tb_product a
        left join ar_customer b on b.code = a.cust_code
        left join product_image c on a.code = c.iteme_code and c.line_number = 0
        where a.code = $1`,
      [code],
    )
  ).rows[0];

  if (!head) notFound();
  if (head.used_spare === 1) await seedDraft(code);

  const [lines, items, rate, docNo] = await Promise.all([
    getDraftLinesByProduct(code),
    getServiceItems(),
    getKipRate(),
    previewDocNo(),
  ]);

  const today = new Date();
  const docDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <QuoteBuilder
      mode="create"
      docNo={docNo}
      docDate={docDate}
      head={{
        productCode: head.product_code,
        custCode: head.cust_code ?? "",
        customer: head.customer,
        productName: head.product_name,
        model: head.model,
        sn: head.sn,
        brand: head.brand,
        warranty: head.warranty,
        issue: head.issue,
        issue2: head.issue_2,
        technician: head.technician,
        productUrl: head.product_url,
      }}
      lines={lines}
      items={items}
      defaultRate={rate}
      defaultDiscount="0"
      defaultRemark=""
    />
  );
}
