import { PageTitle } from "@/components/ui";
import { requireRoleOrRedirect } from "@/lib/guard";
import { warehouses } from "@/lib/erp-lookup";
import { STOCK_SIDE } from "@/lib/roles";
import { REPAIR_WAREHOUSES } from "@/lib/stock-constants";
import { RepairTransferForm } from "./repair-transfer-form";

/**
 * ຂໍໂອນອາໄຫຼ່ມາຫ້ອງສ້ອມ (ບໍ່ຜ່ານໃບຂໍເບີກ) — ໃບ trans_flag 124 = ຄຳຂໍ, ບໍ່ຕັດສະຕ໋ອກ.
 * ຕິດຕາມ/ຮັບຂອງ ຢູ່ /stock/transfers.
 */
export default async function TransferToRepairPage() {
  await requireRoleOrRedirect(STOCK_SIDE);
  // ປາຍທາງ = ສະເພາະ 2 ສາງສ້ອມສູນບໍລິການ (1104/1206) — ດຶງຊື່ຈາກ ERP, ຮຽງຕາມ REPAIR_WAREHOUSES
  const all = await warehouses();
  const byCode = new Map(all.map((wh) => [wh.code, wh]));
  const whs = REPAIR_WAREHOUSES.map((code) => byCode.get(code) ?? { code, name: code });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle sub="ໂອນ (ບໍ່ເບີກ) ຈາກສາງອາໄຫຼ່ → ສາງຫ້ອງສ້ອມ · ບໍ່ຕັດສະຕ໋ອກ">ຂໍໂອນອາໄຫຼ່ມາຫ້ອງສ້ອມ</PageTitle>
      <RepairTransferForm warehouses={whs} />
    </div>
  );
}
