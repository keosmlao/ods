import { QuoteBuilder } from "@/components/quotation/quote-builder";
import { getDraftLinesByDoc, getKipRate, getServiceItems } from "@/components/quotation/queries";
import { getSession } from "@/lib/auth";
import { db, query } from "@/lib/db";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: qt.py before_edit_qt() + editpage_qt() + templates/Qutation/edit_page.html */

type Props = { params: Promise<{ docNo: string }> };

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
  product_url: string | null;
  remark: string | null;
  doc_date: string;
  doc_no: string;
  product_code: string | null;
  cust_code: string | null;
  exchange_rate: string | null;
  total_discount: string | null;
  aprove_status: number;
  remark_2: string | null;
  approver1: string | null;
};

/** ຄື before_edit_qt(): copy ic_trans_detail → ຮ່າງ (ເຮັດຕອນຮ່າງຍັງຫວ່າງ ເຊັ່ນ: ເປີດ URL ໂດຍກົງ) */
async function seedDraft(docNo: string, username: string) {
  if (!db) return;
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734219)");
    await client.query(
      `insert into ic_trans_detail_draft(product_code, item_code, item_name, qty, unit_code, price, sum_amount, user_created, doc_no)
       select product_code, item_code, item_name, qty, unit_code, price, sum_amount, $1, $2
       from ic_trans_detail t
       where t.doc_no = $2
         and not exists (select 1 from ic_trans_detail_draft d where d.doc_no = $2)`,
      [username, docNo],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("seedDraft (edit) failed", error);
  } finally {
    client.release();
  }
}

export default async function EditQuotationPage({ params }: Props) {
  const { docNo } = await params;
  const session = await getSession();

  const head = (
    await query<HeadRow>(
      `select concat_ws('-', b.name_1, b.tel) customer, c.name_1 product_name, c.p_model model, c.sn,
          c.p_brand brand, c.warrunty warranty, c.issue, c.issue_2, c.emp_code technician, d.product_url,
          a.remark, to_char(a.doc_date, 'YYYY-MM-DD') doc_date, a.doc_no, a.product_code, a.cust_code,
          coalesce(a.exchange_rate, 0)::text exchange_rate, coalesce(a.total_discount, 0)::text total_discount,
          coalesce(a.aprove_status, 0)::int aprove_status, a.remark_2, a.approver1
        from ic_trans a
        left join ar_customer b on b.code = a.cust_code
        left join tb_product c on c.code = a.product_code
        left join product_image d on c.code = d.iteme_code and d.line_number = 0
        where a.doc_no = $1 and a.trans_flag = 17`,
      [docNo],
    )
  ).rows[0];

  if (!head) notFound();
  if (session) await seedDraft(docNo, session.username);

  const [lines, items] = await Promise.all([getDraftLinesByDoc(docNo), getServiceItems()]);
  const rate = Number(head.exchange_rate) > 0 ? head.exchange_rate! : await getKipRate();

  return (
    <div className="w-full space-y-4">
      {/* ຖືກ "ບໍ່ອະນຸມັດ" ມາ (2) ຫຼື ອະນຸມັດແລ້ວແຕ່ກຳລັງຖືກແກ້ (1) — ບອກໃຫ້ຮູ້ວ່າຈະເກີດຫຍັງຕອນບັນທຶກ */}
      {head.aprove_status === 2 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">ໃບສະເໜີລາຄານີ້ບໍ່ໄດ້ຮັບການອະນຸມັດ</p>
          <p className="mt-1">
            ເຫດຜົນ: {head.remark_2?.trim() || "ບໍ່ໄດ້ລະບຸ"}
            {head.approver1 ? ` · ໂດຍ ${head.approver1}` : ""}
          </p>
          <p className="mt-1 text-xs">ແກ້ໄຂລາຄາ/ລາຍການ ແລ້ວກົດບັນທຶກ — ໃບຈະຖືກສົ່ງໄປຂໍອະນຸມັດຄືນອັດຕະໂນມັດ</p>
        </div>
      )}
      {head.aprove_status === 1 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">ໃບສະເໜີລາຄານີ້ອະນຸມັດພາຍໃນແລ້ວ</p>
          <p className="mt-1 text-xs">ຖ້າບັນທຶກການແກ້ໄຂ ການອະນຸມັດເກົ່າຈະຖືກຍົກເລີກ ແລະ ຕ້ອງຂໍອະນຸມັດຄືນໃໝ່</p>
        </div>
      )}

      <QuoteBuilder
        mode="edit"
        docNo={head.doc_no}
        docDate={head.doc_date}
        head={{
          productCode: head.product_code ?? "",
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
        defaultDiscount={head.total_discount ?? "0"}
        defaultRemark={head.remark ?? ""}
      />
    </div>
  );
}
