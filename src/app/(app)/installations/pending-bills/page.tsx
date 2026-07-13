import { Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { pendingInstallBills } from "@/lib/pending-bills";
import { FilePlus2, TriangleAlert } from "lucide-react";

/**
 * **ບິນທີ່ຄ້າງອອກໃບງານ** — ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ ແຕ່ຍັງບໍ່ມີໃບງານ (ຫຼື ມີບໍ່ຄົບ).
 *
 * ຄິວທຸກໜ້າຂອງໂມດູນຕິດຕັ້ງເລີ່ມນັບຈາກ "ໃບງານທີ່ເປີດແລ້ວ" ⇒ ບິນທີ່ລືມເປີດ
 * **ບໍ່ປາກົດຢູ່ໃສເລີຍ**. ໜ້ານີ້ຄືດ້ານກົງກັນຂ້າມ: ເລີ່ມຈາກ **ເງິນທີ່ຮັບມາແລ້ວ**
 * ແລ້ວຖາມວ່າ "ງານຢູ່ໃສ" (ເບິ່ງ lib/pending-bills — ຂໍ້ມູນຈິງ 181 ໜ່ວຍຄ້າງ).
 */
export const dynamic = "force-dynamic";

export default async function PendingBillsPage() {
  const bills = await pendingInstallBills();
  const units = bills.reduce((sum, bill) => sum + bill.missing, 0);

  return (
    <div className="w-full space-y-4">
      <PageTitle sub="ລູກຄ້າຈ່າຍຄ່າຕິດຕັ້ງແລ້ວ ແຕ່ຍັງບໍ່ມີໃບງານ — ຄ້າງດົນສຸດຂຶ້ນກ່ອນ">
        ບິນທີ່ຄ້າງອອກໃບງານ
      </PageTitle>

      {bills.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          <TriangleAlert className="size-4" />
          {bills.length} ບິນ · ຄ້າງ {units} ໜ່ວຍ — ເງິນຮັບມາແລ້ວ ແຕ່ຍັງບໍ່ມີໃຜໄປຕິດ
        </p>
      )}

      {bills.length === 0 ? (
        <Empty>ບໍ່ມີບິນຄ້າງ — ທຸກບິນທີ່ຈ່າຍຄ່າຕິດຕັ້ງ ມີໃບງານຄົບແລ້ວ</Empty>
      ) : (
        <Table head={["ເລກບິນ", "ວັນທີ", "ຄ້າງມາ", "ລູກຄ້າ", "ຈ່າຍຄ່າຕິດຕັ້ງ", "ເປີດໃບງານແລ້ວ", "ຍັງຂາດ", ""]} minWidth={1000}>
          {bills.map((bill) => (
            <tr key={bill.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-800">{bill.doc_no}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500">
                {bill.doc_date.split("-").reverse().join("-")}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                {/* ຄ້າງເກີນ 7 ມື້ = ລູກຄ້າລໍດົນເກີນໄປແລ້ວ */}
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                    bill.days >= 7 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {bill.days} ມື້
                </span>
              </td>
              <td className="px-3 py-2.5 text-sm text-slate-700">
                {bill.cust_name || "-"}
                {bill.telephone && <span className="ml-2 text-xs text-slate-400">{bill.telephone}</span>}
              </td>
              <td className="px-3 py-2.5 text-center text-sm">{bill.paid}</td>
              <td className="px-3 py-2.5 text-center text-sm text-slate-500">{bill.opened}</td>
              <td className="px-3 py-2.5 text-center text-sm font-bold text-red-600">{bill.missing}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                {/* ຟອມເປີດງານຄົ້ນບິນດ້ວຍເລກຢູ່ແລ້ວ ⇒ ສົ່ງເລກໄປໃຫ້ມັນຄົ້ນເອງ */}
                <LinkButton href={`/installations/new?bill=${encodeURIComponent(bill.doc_no)}`} tone="success" className="h-8 text-xs">
                  <FilePlus2 className="size-3.5" />
                  ເປີດໃບງານ
                </LinkButton>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
