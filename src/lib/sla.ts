/**
 * ກຳນົດເວລາ (SLA) ຂອງຂັ້ນຕອນກວດເຊັກ.
 *
 * ນັບແຍກ 2 ຂັ້ນ — ລໍຖ້າກວດເຊັກ ແລະ ກຳລັງກວດເຊັກ — ແຕ່ລະຂັ້ນມີເວລາຂອງຕົນເອງ.
 * ເວລາທີ່ອະນຸຍາດ ຂຶ້ນກັບ "ປະເພດບໍລິການ" (tb_product.service_type):
 *
 *   CI ລູກຄ້ານຳເຄື່ອງເຂົ້າ   →  2 ຊົ່ວໂມງ  (ລູກຄ້າລໍຢູ່)
 *   ST ສ້ອມເຄື່ອງໃນສາງ       →  2 ຊົ່ວໂມງ  (ເຄື່ອງຢູ່ໃນມືແລ້ວ)
 *   IH ສ້ອມບ້ານລູກຄ້າ        → 12 ຊົ່ວໂມງ
 *   PS ໄປຮັບບ້ານລູກຄ້າ       → 12 ຊົ່ວໂມງ
 */

const HOUR = 3600;

/** ວິນາທີທີ່ອະນຸຍາດ ຕໍ່ປະເພດບໍລິການ — ບໍ່ມີໃນນີ້ = ບໍ່ນັບ SLA */
export const SLA_SECONDS: Record<string, number> = {
  CI: 2 * HOUR,
  ST: 2 * HOUR,
  IH: 12 * HOUR,
  PS: 12 * HOUR,
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  CI: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ",
  PS: "ໄປຮັບບ້ານລູກຄ້າ",
  IH: "ສ້ອມບ້ານລູກຄ້າ",
  ST: "ສ້ອມເຄື່ອງໃນສາງ",
};

/** SQL ຂອງ "ວິນາທີທີ່ອະນຸຍາດ" — ໃຊ້ນັບຈຳນວນເກີນກຳນົດຢູ່ຝັ່ງ DB */
export const SLA_SQL = `case a.service_type
  when 'CI' then ${2 * HOUR}
  when 'ST' then ${2 * HOUR}
  when 'IH' then ${12 * HOUR}
  when 'PS' then ${12 * HOUR}
  else null end`;

export type SlaState = "none" | "ok" | "warn" | "late";

/**
 * ສະຖານະ SLA ຂອງລາຍການນຶ່ງ.
 *   ok   ຍັງມີເວລາ
 *   warn ໃຊ້ໄປແລ້ວ ≥ 75% ຂອງເວລາ
 *   late ເກີນກຳນົດແລ້ວ
 *   none ປະເພດບໍລິການນີ້ບໍ່ໄດ້ກຳນົດເວລາ
 */
export function slaState(seconds: number | null, serviceType: string | null): SlaState {
  const limit = serviceType ? SLA_SECONDS[serviceType] : undefined;
  if (!limit || seconds == null) return "none";
  if (seconds > limit) return "late";
  if (seconds >= limit * 0.75) return "warn";
  return "ok";
}

/** ສີຂອງປ້າຍເວລາ ຕາມສະຖານະ SLA */
export function slaTone(state: SlaState) {
  switch (state) {
    case "late":
      return { chip: "bg-red-600 text-white", bar: "bg-red-600" };
    case "warn":
      return { chip: "bg-amber-100 text-amber-800", bar: "bg-amber-400" };
    case "ok":
      return { chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-400" };
    default:
      return { chip: "bg-slate-100 text-slate-600", bar: "bg-slate-200" };
  }
}

/** ຂໍ້ຄວາມບອກກຳນົດເວລາ ເຊັ່ນ "ກຳນົດ 2 ຊມ" */
export function slaLabel(serviceType: string | null): string | null {
  const limit = serviceType ? SLA_SECONDS[serviceType] : undefined;
  if (!limit) return null;
  return `ກຳນົດ ${limit / HOUR} ຊມ`;
}
