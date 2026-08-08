import { query } from "@/lib/db";
import { pushEventKey } from "@/lib/push-event-shared";

/**
 * **ຍິງອັນໃດເຂົ້າແອັບ** — ພາກທີ່ຖາມຖານ. ນິຍາມ/ປ້າຍຊື່ຢູ່ lib/push-event-shared.
 * ຄຸມແຕ່ Firebase push; ແຖວແຈ້ງເຕືອນຍັງຂຽນຄົບ (ເບິ່ງໝາຍເຫດຢູ່ shared).
 */
export * from "@/lib/push-event-shared";

/**
 * ຄູ່ `model:kind` ທີ່ຖືກ**ປິດ**. ຄືນເປັນ "ອັນທີ່ປິດ" ບໍ່ແມ່ນ "ອັນທີ່ເປີດ" ໂດຍຕັ້ງໃຈ:
 * ຖາມຖານບໍ່ໄດ້ ຫຼື ຍັງບໍ່ໄດ້ແລ່ນ migration ⇒ ຄືນ Set ຫວ່າງ = **ຍິງໝົດຄືເກົ່າ**
 * (ຖານລົ້ມບໍ່ຄວນເຮັດໃຫ້ແຈ້ງເຕືອນທັງລະບົບຫາຍງຽບ).
 */
export async function disabledPushEvents(): Promise<Set<string>> {
  try {
    const rows = (
      await query<{ model: string; kind: string }>(
        "select model, kind from ods_push_event where enabled = false",
      )
    ).rows;
    return new Set(rows.map((row) => pushEventKey(row.model, row.kind)));
  } catch (error) {
    console.error("disabledPushEvents failed", error);
    return new Set();
  }
}

/** ທຸກແຖວທີ່ຕັ້ງໄວ້ — ໃຫ້ໜ້າຈັດການໃຊ້ (ບໍ່ມີແຖວ = ຍັງບໍ່ເຄີຍແຕະ = ເປີດ) */
export async function listPushEvents(): Promise<{ model: string; kind: string; enabled: boolean }[]> {
  try {
    return (
      await query<{ model: string; kind: string; enabled: boolean }>(
        "select model, kind, enabled from ods_push_event",
      )
    ).rows;
  } catch (error) {
    console.error("listPushEvents failed", error);
    return [];
  }
}
