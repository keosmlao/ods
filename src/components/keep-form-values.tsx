"use client";
import { useEffect, useRef } from "react";

/**
 * **ກັນຟອມຖືກລ້າງຕອນ submit** — ວາງໄວ້ໃນ `<form action={...}>` ໃດກໍ່ໄດ້.
 *
 * ── ບັນຫາທີ່ແກ້ ──
 * React 19 ສັ່ງ `form.reset()` ໃຫ້ເອງ **ທຸກຄັ້ງທີ່ submit** ຜ່ານ `<form action={fn}>`
 * (react-dom: `startHostTransition` → `requestFormReset` → commit ເອີ້ນ `form.reset()`).
 * ⇒ ຮອບທຳອິດ error (ຂໍ້ມູນບໍ່ຄົບ · ພົບລາຍການຊ້ຳ · ບໍ່ມີສິດ ...) ທຸກຊ່ອງທີ່**ບໍ່ໄດ້ຜູກ state**
 * ຈະຫວ່າງໝົດ: ອາການເສຍທີ່ພິມໄວ້ຍາວໆ · ໝາຍເຫດ · **ໄຟລ໌ທີ່ແນບ** ⇒ ຄົນຕ້ອງພິມ/ແນບໃໝ່
 * ໂດຍທີ່ໜ້າຈໍບໍ່ໄດ້ບອກວ່າມັນຫາຍ (ຮູບຫຍໍ້ຍັງສະແດງຢູ່ ເພາະ preview ຢູ່ໃນ state).
 *
 * ── ໃສ່ບ່ອນໃດ ──
 * ຟອມທີ່ **ສຳເລັດແລ້ວອອກຈາກໜ້ານັ້ນ** (action `redirect()` ຫຼື ຟອມຖືກຖອດອອກ) — ຟອມພວກນັ້ນ
 * ບໍ່ໄດ້ອາໄສ auto-reset ຢູ່ແລ້ວ ⇒ ກັນໄດ້ຢ່າງປອດໄພ.
 * **ຢ່າ**ໃສ່ຟອມທີ່ຢູ່ໜ້າເກົ່າແລ້ວຕ້ອງການໃຫ້ຊ່ອງຫວ່າງຄືນເພື່ອຕື່ມລາຍການຕໍ່ໄປ
 * (ກ່ອງຄອມເມັ້ນ chatter · ຟອມເພີ່ມແຖວຢູ່ໜ້າ manage) — ບ່ອນນັ້ນ reset ຄືສິ່ງທີ່ຢາກໄດ້.
 */
export function KeepFormValues() {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    // reset ເປັນ event ຍົກເລີກໄດ້ ⇒ ຢຸດໄວ້ ຄ່າໃນຟອມຈຶ່ງຄາຢູ່ຄືເກົ່າ
    const block = (event: Event) => event.preventDefault();
    form.addEventListener("reset", block);
    return () => form.removeEventListener("reset", block);
  }, []);

  // ບໍ່ມີ name ⇒ ບໍ່ຖືກສົ່ງໄປ server, ມີໄວ້ພຽງເພື່ອຫາ <form> ແມ່ຂອງມັນ
  return <input ref={ref} type="hidden" />;
}
