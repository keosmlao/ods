import { SLA_CHIP, slaLabel, slaState } from "@/lib/install-sla";

/**
 * ນາລິກາ **24 ຊົ່ວໂມງ ນັບແຕ່ອອກບິນ** ຂອງງານຕິດຕັ້ງ.
 *
 * ເປົ້າໝາຍທີ່ຢູ່ແຕ່ໃນລາຍງານ = ເປົ້າໝາຍທີ່ບໍ່ມີຜົນ ⇒ ເອົາມາໄວ້ **ໃນຄິວທີ່ຄົນເຮັດວຽກ**
 * (ຈັດຊ່າງ · ຮັບງານ) — ສອງຂັ້ນນີ້ກິນເວລາລວມ ~88 ຊມ ຈາກ 81.5 ຊມ ທີ່ໃຊ້ຈິງ.
 *
 * ບິນເກົ່າທີ່ບໍ່ມີວັນທີ ⇒ ບໍ່ມີນາລິກາ (ຂີດ) — ບໍ່ເດົາ.
 */
export function SlaChip({ left }: { left: number | null }) {
  const state = slaState(left);
  if (state === "none") return <span className="text-xs text-slate-300">-</span>;

  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold ${SLA_CHIP[state]}`}>
      {slaLabel(left)}
    </span>
  );
}
