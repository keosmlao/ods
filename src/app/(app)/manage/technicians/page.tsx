import { technicianLinks } from "@/app/actions/user-link";
import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { AlertTriangle } from "lucide-react";
import { LinkRow } from "./link-form";

/**
 * ເຊື່ອມຕົວຕົນຊ່າງ — **ຜູ້ຈັດການເທົ່ານັ້ນ** (ຕັດສິນວ່າເງິນເຂົ້າບັນຊີໃຜ).
 *
 * ງານບັນທຶກຊ່າງໄວ້ເປັນຊື່ຜູ້ໃຊ້ ODS ('Xiew', 'sak', 'Mee') ເຊິ່ງເປັນ **ຊື່ຫຼິ້ນລາວ
 * ທີ່ຂຽນເປັນອັກສອນລາຕິນ** (ຊີວ · ສັກ · ມີ) ສ່ວນຜູ້ຮັບເງິນບົດບາດອື່ນເປັນ
 * employee_code ຂອງ ERP ⇒ ຄົນລະລະບົບຕົວຕົນ. ໜ້ານີ້ຄືສະພານ.
 *
 * ຊ່າງທີ່ **ຍັງບໍ່ເຊື່ອມ** → ຄ່າຄອມຂອງລາວຈະບໍ່ຜູກກັບພະນັກງານ ERP
 * ⇒ ບໍ່ຂຶ້ນໃນລາຍງານລາຍຮັບ (ເງິນຄ້າງ). ຈຶ່ງໃຫ້ຂຶ້ນກ່ອນ ແລະ ເນັ້ນສີ.
 */
export const dynamic = "force-dynamic";

export default async function TechnicianLinkPage() {
  const { rows, employees } = await technicianLinks();
  const unlinked = rows.filter((row) => !row.employee_code).length;

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ຈັບຄູ່ຊື່ຜູ້ໃຊ້ໃນງານ ກັບ ພະນັກງານ ERP — ຕັດສິນວ່າຄ່າຄອມເຂົ້າບັນຊີໃຜ">
        ເຊື່ອມຕົວຕົນຊ່າງ
      </PageTitle>

      {unlinked > 0 && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <b>{unlinked} ຄົນ</b> ຍັງບໍ່ໄດ້ເຊື່ອມ — ຄ່າຄອມຂອງເຂົາເຈົ້າຈະ<b>ບໍ່ຂຶ້ນໃນລາຍງານລາຍຮັບ</b>{" "}
            (ບັນທຶກໄວ້ ແຕ່ບໍ່ຜູກກັບພະນັກງານ ERP). ປຸ່ມ &quot;ນ່າຈະແມ່ນ&quot; ເປັນພຽງການເດົາຈາກຊື່ຫຼິ້ນ —
            ກະລຸນາກວດກ່ອນບັນທຶກ.
          </span>
        </p>
      )}

      <Card title={`ຊ່າງທີ່ປາກົດໃນງານ (${rows.length})`}>
        {rows.length === 0 ? (
          <Empty>ບໍ່ມີຊ່າງໃນງານ</Empty>
        ) : (
          <Table head={["ຊື່ໃນງານ", "ຈຳນວນງານ", "ພະນັກງານ ERP"]} minWidth={760}>
            {rows.map((row) => (
              <LinkRow key={row.user_code} row={row} employees={employees} />
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
