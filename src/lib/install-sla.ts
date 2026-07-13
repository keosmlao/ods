/**
 * **ນາລິກາ 24 ຊົ່ວໂມງ ຂອງງານຕິດຕັ້ງ** — ນັບແຕ່ **ອອກບິນ** ຫາ **ຕິດຕັ້ງແລ້ວ**.
 *
 * ── ເປັນຫຍັງຕ້ອງຢູ່ໃນຄິວ ບໍ່ແມ່ນຢູ່ໃນລາຍງານ ──
 * KPI ບອກວ່າເຮັດໄດ້ພຽງ **1.7%** (ມັດທະຍົມ 81.5 ຊມ) ແຕ່ຄົນທີ່ຈັດຊ່າງ/ຮັບງານ
 * **ບໍ່ເຫັນນາລິກາ** ⇒ ບໍ່ຮູ້ວ່າງານໃດກຳລັງຈະເລີຍກຳນົດ. ເປົ້າໝາຍທີ່ບໍ່ປາກົດຢູ່ບ່ອນ
 * ທີ່ຄົນຕັດສິນໃຈ = ເປົ້າໝາຍທີ່ບໍ່ມີຜົນ.
 *
 * ⚠️ ນັບຈາກ **doc_ref_date (ວັນທີບິນ)** ບໍ່ແມ່ນ time_register — ລູກຄ້າເລີ່ມລໍຕັ້ງແຕ່
 * ຈ່າຍເງິນ. ບິນທີ່ບໍ່ມີວັນທີ (ຂໍ້ມູນເກົ່າ) ⇒ ບໍ່ມີນາລິກາ (null) ບໍ່ແມ່ນເດົາເອົາ.
 *
 * ເວລາທີ່ຫາຍໄປຈິງ (90 ມື້): ອອກບິນ→ເປີດງານ 15.7 ຊມ · ເປີດງານ→ຈັດຊ່າງ 44.1 ຊມ ·
 * ລໍຊ່າງຮັບ 44.1 ຊມ · **ຮັບແລ້ວ→ຕິດແລ້ວ ~0 ຊມ** ⇒ ຄໍຂວດຢູ່ກ່ອນຊ່າງລົງມື.
 */

/** ເປົ້າໝາຍ (ຊົ່ວໂມງ) — ຢູ່ບ່ອນດຽວກັບ lib/kpi ໃຊ້ */
export const INSTALL_TARGET_HOURS = 24;

/**
 * ວິນາທີທີ່ **ຍັງເຫຼືອ** ຈົນຄົບ 24 ຊມ ນັບແຕ່ອອກບິນ (ຕິດລົບ = ເລີຍກຳນົດແລ້ວ).
 * ງານທີ່ **ຕິດຕັ້ງແລ້ວ** ⇒ ຢຸດນາລິກາທີ່ເວລາຕິດຕັ້ງແລ້ວ (ບໍ່ໃຫ້ນັບຕໍ່ໄປເລື້ອຍໆ).
 * ⚠️ ຕ້ອງ alias ຕາຕະລາງ ods_tb_install ເປັນ `a`.
 */
export const INSTALL_LEFT_SQL = `case
  when a.doc_ref_date is null then null
  else extract(epoch from (
    a.doc_ref_date + interval '${INSTALL_TARGET_HOURS} hours'
    - coalesce(a.finish_install, localtimestamp)
  ))
end`;

export type SlaLeft = "none" | "ok" | "soon" | "late";

/** ໜ້ອຍກວ່ານີ້ = ໃກ້ໝົດເວລາ (ຊົ່ວໂມງ) */
const SOON_HOURS = 6;

export function slaState(secondsLeft: number | null): SlaLeft {
  if (secondsLeft == null) return "none";
  if (secondsLeft < 0) return "late";
  return secondsLeft < SOON_HOURS * 3600 ? "soon" : "ok";
}

/** "ເຫຼືອ 5 ຊມ 20 ນທ" · "ເລີຍ 2 ມື້ 3 ຊມ" */
export function slaLabel(secondsLeft: number | null): string {
  if (secondsLeft == null) return "-";
  const late = secondsLeft < 0;
  const total = Math.abs(secondsLeft);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  const parts = days > 0 ? `${days} ມື້ ${hours} ຊມ` : hours > 0 ? `${hours} ຊມ ${minutes} ນທ` : `${minutes} ນທ`;
  return late ? `ເລີຍ ${parts}` : `ເຫຼືອ ${parts}`;
}

export const SLA_CHIP: Record<SlaLeft, string> = {
  none: "bg-slate-100 text-slate-400",
  ok: "bg-emerald-50 text-emerald-700",
  soon: "bg-amber-100 text-amber-800",
  late: "bg-red-100 text-red-700",
};
