import { BackLink } from "@/components/back-link";
import { Lock } from "lucide-react";

/**
 * **ຫົວຂອງໜ້າແກ້ໄຂໃບງານ — ໃຊ້ຮ່ວມທຸກສາຍງານ** (ສ້ອມ · ເຄມ · ຕິດຕັ້ງ · ບຳລຸງຮັກສາ).
 *
 * ── ເປັນຫຍັງລວມ ──
 * ໜ້າແກ້ໄຂ 4 ໜ້າເຄີຍມີຫົວຄົນລະແບບ: ບາງໜ້າມີປຸ່ມກັບ ບາງໜ້າບໍ່ມີ · ບາງໜ້າບອກຊື່ສິນຄ້າ/SN
 * ບາງໜ້າບອກແຕ່ເລກ ⇒ ຄົນລະສາຍງານໃຊ້ຄົນລະຄວາມຮູ້ສຶກ ທັງທີ່ເປັນວຽກອັນດຽວກັນ ("ແກ້ໃບງານ").
 *
 * ── ສ່ວນທີ່ສຳຄັນທີ່ສຸດຄື `locked` ──
 * ດ່ານຝັ່ງ server ກັນການແກ້ຊ່ອງທີ່ກະທົບເງິນ/ຂັ້ນຕອນຫຼັງງານຈົບ (ເບິ່ງ updateService ·
 * updateInstall · updateMaintenance) ແຕ່ **ຄົນຈະຮູ້ກໍ່ຕໍ່ເມື່ອກົດບັນທຶກແລ້ວ** ⇒ ຕື່ມຟອມ
 * ຈົນຈົບແລ້ວຄ່ອຍຖືກປະຕິເສດ. ບອກໄວ້ຢູ່ຫົວໜ້າຈຶ່ງບໍ່ເສຍເວລາຄົນ.
 */
export function JobEditHeader({
  back,
  title,
  subtitle,
  locked,
}: {
  back: { href: string; label: string };
  title: string;
  /** ຊື່ສິນຄ້າ · SN · ລູກຄ້າ — ບອກວ່າກຳລັງແກ້ໃບໃດ ໂດຍບໍ່ຕ້ອງກັບໄປເບິ່ງ */
  subtitle?: string | null;
  /** ຄຳເຕືອນວ່າຊ່ອງໃດແກ້ບໍ່ໄດ້ແລ້ວ (null = ແກ້ໄດ້ໝົດ) */
  locked?: string | null;
}) {
  return (
    <div className="space-y-3">
      <div>
        <BackLink fallback={back.href} label={back.label} />
        <h1 className="text-xl font-bold text-slate-700">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {locked && (
        <p className="flex items-start gap-2 rounded-xl border border-brand-orange-300 bg-brand-orange-50 px-3 py-2 text-[12px] font-medium text-brand-orange-700">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>{locked}</span>
        </p>
      )}
    </div>
  );
}
