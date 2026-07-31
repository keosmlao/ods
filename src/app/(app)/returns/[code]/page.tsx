import { getOutstandingSpares, groupByDoc } from "@/lib/outstanding-spares";
import { getBanks, getHead, getServices, previewDocNo } from "@/lib/return-page-data";
import { OutstandingSpares } from "@/app/(app)/approvals/cancellations/outstanding-spares";
import { getCart, getRates, seedCart } from "@/app/actions/return";
import { Chatter } from "@/components/chatter/chatter";
import { InvoiceEditor } from "@/components/return/invoice-editor";
import { LinkButton, PageTitle } from "@/components/ui";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { ReturnWithoutInvoice } from "./return-without-invoice";

/** ຖອດແບບຈາກ ods: returnproduct.py showreturn() + templates/returnProduct/showDetail.html */

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

  // ຄ່າຈາກ ERP (ອັດຕາ/ບັນຊີ/ຄ່າບໍລິການ) ຂັດຂ້ອງຊົ່ວຄາວ → ໃຫ້ໜ້າໂຫຼດຕໍ່ໄດ້ດ້ວຍຄ່າວ່າງ
    // ແທນທີ່ຈະພັງທັງໜ້າ ("This page couldn't load"). ຕອນບັນທຶກ server ດຶງອັດຕາຄືນເອງ.
  const [cart, rates, banks, services, docNo, spares] = await Promise.all([
    getCart(head.code),
    getRates().catch(() => ({ "01": 1, "02": 0, "03": 0 })),
    getBanks().catch(() => []),
    getServices().catch(() => []),
    previewDocNo().catch(() => ""),
    cancelled ? getOutstandingSpares(head.code) : Promise.resolve([]),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <div className="flex justify-end">
        <LinkButton
          href={`/returns/${encodeURIComponent(head.code)}/handover-print`}
          tone="neutral"
        >
          <Printer className="size-4" />
          ພິມໃບຄືນເຄື່ອງ
        </LinkButton>
      </div>
      {waitingApproval && (
        <PageTitle sub="ສົ່ງຄືນໂດຍບໍ່ສ້ອມ · ໃບຮັບເງິນ">ລາຍລະອຽດໃບເບີກ</PageTitle>
      )}

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
          {/* QuotationPrices ຖອດອອກ — ລາຍການໃບສະເໜີລາຄາຢູ່ໃນບິນແລ້ວ (cart seed ຈາກ quote),
              ບໍ່ຕ້ອງສະແດງກາดซ้ำตอนออกใบรับเงิน */}
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
