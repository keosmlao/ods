import { redirect } from "next/navigation";

/**
 * **ຂັ້ນອາໄຫຼ່ ຢູ່ໃນຊຸດ URL ດຽວກັບຂັ້ນອື່ນ** — `/dashboard/status/repair/spares`.
 *
 * ທຸກຂັ້ນຂອງສາຍງານສ້ອມເປັນ `/dashboard/status/repair/<slug>` ⇒ ຂັ້ນອາໄຫຼ່ກໍ່ຕ້ອງເປັນແບບດຽວກັນ
 * (ຄົນຈື່ຮູບແບບ URL ອັນດຽວ ແລະ ລິ້ງເກົ່າ/bookmark ຍັງໃຊ້ໄດ້). ໜ້າຈິງຢູ່ /work/spares
 * ເພາະມັນບໍ່ໄດ້ອີງ STAGE_SQL ຂັ້ນດຽວ ແຕ່ອີງ **ເອກະສານ** (SIO · SWC · RQ) ຂ້າມ 3 ຂັ້ນ.
 */
export default function SpareStatusRedirect() {
  redirect("/work/spares");
}
