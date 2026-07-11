import { getCart, getRates, seedCart } from "@/app/actions/return";
import { Chatter } from "@/components/chatter/chatter";
import { InvoiceEditor, type Bank, type BillHead, type Service } from "@/components/return/invoice-editor";
import { PageTitle } from "@/components/ui";
import { db, queryOdg } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { notFound } from "next/navigation";

/** ຖອດແບບຈາກ ods: returnproduct.py showreturn() + templates/returnProduct/showDetail.html */

type Head = BillHead & { used_spare: number | null };

async function getHead(code: string) {
  if (!db) throw new Error("DATABASE_URL is not configured");
  const result = await db.query<Head>(
    `select a.code, a.cust_code, b.name_1 cust_name, b.tel,
        concat_ws(',', b.address, d.name_1, c.name_1) address,
        a.name_1 product, a.p_model model, a.p_brand brand, a.sn, a.warrunty warranty,
        a.issue, a.issue_2, a.emp_code, a.p_access, a.user_regis, a.used_spare, e.product_url
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

  // ຕື່ມອາໄຫຼ່ເຂົ້າຕະກ້າຄັ້ງທຳອິດ — idempotent, ເອີ້ນຊ້ຳກໍ່ບໍ່ຊ້ຳແຖວ
  await seedCart(head.code, head.warranty, head.used_spare);

  const [cart, rates, banks, services, docNo] = await Promise.all([
    getCart(head.code),
    getRates(),
    getBanks(),
    getServices(),
    previewDocNo(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ໃບຮັບເງິນ">ລະລະອຽດໃບເບີກ</PageTitle>
      <InvoiceEditor
        head={head}
        cart={cart}
        rates={rates}
        banks={banks}
        services={services}
        docNo={docNo}
        today={today}
      />
      <Chatter model="tb_product" resId={head.code} />
    </div>
  );
}
