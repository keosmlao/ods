import { PoEditor, type IssueFrom } from "@/components/purchase/po-editor";
import { queryOdg } from "@/lib/db";
import { currencies, transportTypes, warehouses } from "@/lib/erp-lookup";
import { searchSuppliers } from "@/lib/erp-supplier";
import { ERP_PURCHASE } from "@/lib/stock-constants";
import { notFound } from "next/navigation";

/**
 * **ໜ້າອອກໃບສັ່ງຊື້ (PO)** — ຟອມດຽວ ໃຊ້ສອງທາງ:
 *
 *   ① ບໍ່ມີ `?from=` → ອອກ PO **ລອຍ** (ຄືກົດ New ໃນ Odoo): ຊື້ຕຸນເຂົ້າສາງ/ຊື້ດ່ວນ
 *      ທີ່ບໍ່ໄດ້ເກີດຈາກໃບຂໍຊື້ຂອງວຽກ — ERP ເອງກໍ່ອອກແບບນີ້ 60% ຂອງ PO.
 *   ② `?from=WPRA…` → ອອກ PO **ຈາກໃບຂໍຊື້ທີ່ອະນຸມັດແລ້ວ**: ແຖວມາຈາກໃບອະນຸມັດ
 *      ແຕ່ **ລາຄາຕ້ອງໃສ່ຢູ່ນີ້** ເພາະໃບຂໍຊື້ຂອງຊ່າງບໍ່ຮູ້ລາຄາ (ອອກມາ price=0)
 *      ⇒ ຟອມນ້ອຍໆໃນແຖບບໍ່ພຽງພໍ ຕ້ອງເປັນໜ້າ PO ເຕັມ.
 *
 * ດ່ານອະນຸມັດ PO (WPOA) ຍັງຢູ່ທັງສອງທາງ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ from?: string }> };

type WpraHead = { doc_no: string; spr: string | null; job: string | null; branch_code: string | null; po: string | null };
type WpraLine = { item_code: string; item_name: string | null; unit_code: string | null; qty: string; price: string };

/** ໃບອະນຸມັດ + ແຖວຂອງມັນ — ຄືນ null ຖ້າໃບບໍ່ມີ ຫຼື ອອກ PO ໄປແລ້ວ */
async function loadFrom(wpraNo: string): Promise<IssueFrom | null> {
  const head = (
    await queryOdg<WpraHead>(
      `select t.doc_no,
          split_part(trim(coalesce(t.doc_ref,'')),' ',1) spr,
          (select split_part(trim(coalesce(s.doc_ref,'')),' ',1) from ic_trans s
            where s.doc_no = split_part(trim(coalesce(t.doc_ref,'')),' ',1) and s.trans_flag=$2 limit 1) job,
          t.branch_code,
          (select min(p.doc_no) from ic_trans_detail p where p.trans_flag=$3 and p.ref_doc_no=t.doc_no) po
        from ic_trans t where t.doc_no=$1 and t.trans_flag=$4`,
      [wpraNo, ERP_PURCHASE.PR_REQUEST, ERP_PURCHASE.ORDER, ERP_PURCHASE.PR_APPROVE],
    )
  ).rows[0];
  // ອອກ PO ໄປແລ້ວ ⇒ ບໍ່ໃຫ້ອອກຊ້ຳ (action ກໍ່ກັນອີກຊັ້ນ)
  if (!head || head.po) return null;

  const lines = (
    await queryOdg<WpraLine>(
      `select item_code, item_name, unit_code, qty::text, coalesce(price,0)::text price
         from ic_trans_detail where doc_no=$1 and trans_flag=$2 order by line_number`,
      [wpraNo, ERP_PURCHASE.PR_APPROVE],
    )
  ).rows;
  if (lines.length === 0) return null;

  const isJob = /^(\d+|INST-\w+)$/.test(head.job ?? "");
  return {
    wpraNo: head.doc_no,
    sprNo: head.spr,
    jobCode: isJob ? head.job : null,
    branch: head.branch_code ?? "00",
    lines: lines.map((line) => ({
      item_code: line.item_code,
      item_name: line.item_name ?? "",
      unit_code: line.unit_code ?? "",
      qty: Number(line.qty),
      price: Number(line.price),
    })),
  };
}

export default async function NewPurchaseOrderPage({ searchParams }: Props) {
  const { from: fromNo } = await searchParams;
  const from = fromNo ? await loadFrom(decodeURIComponent(fromNo)) : null;
  if (fromNo && !from) notFound();

  const [suppliers, transports, whs, curr] = await Promise.all([
    searchSuppliers("", 300),
    transportTypes(),
    warehouses(),
    currencies(),
  ]);
  // ວັນທີຕັ້ງຕົ້ນມາຈາກ server — ຄືເຂດເວລາທີ່ action ໃຊ້ຕອນອອກເລກໃບ
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PoEditor
      suppliers={suppliers}
      transports={transports}
      warehouses={whs}
      currencies={curr}
      today={today}
      from={from ?? undefined}
    />
  );
}
