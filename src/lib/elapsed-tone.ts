/**
 * ສີເຕືອນຕາມເວລາທີ່ຄ້າງ — ໃຊ້ໄດ້ທັງ server ແລະ client component.
 * (ແຍກອອກຈາກ components/elapsed.tsx ເພາະໄຟລ໌ນັ້ນເປັນ "use client"
 *  ຈຶ່ງເອີ້ນຟັງຊັນຂອງມັນຈາກ server component ບໍ່ໄດ້)
 */
export function elapsedTone(seconds: number | null) {
  if (seconds == null) return { chip: "bg-slate-100 text-slate-500", bar: "bg-slate-200" };
  const days = seconds / 86400;
  if (days >= 30) return { chip: "bg-red-600 text-white", bar: "bg-red-600" };
  if (days >= 7) return { chip: "bg-red-100 text-red-700", bar: "bg-red-400" };
  if (days >= 3) return { chip: "bg-amber-100 text-amber-800", bar: "bg-amber-400" };
  return { chip: "bg-slate-100 text-slate-600", bar: "bg-slate-200" };
}
