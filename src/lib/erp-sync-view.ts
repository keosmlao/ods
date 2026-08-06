import { db } from "@/lib/db";
import { syncErpDispatch, syncErpReturns } from "@/lib/erp-dispatch";
import { syncErpPurchase } from "@/lib/erp-purchase";

/**
 * **ດຶງຂອງຈາກ ERP ຕອນມີຄົນເປີດໜ້າ — ແທນ cron ພາຍນອກ** (06-08-2026).
 *
 * ── ເປັນຫຍັງ ──
 * ເມື່ອກ່ອນ 3 ຕົວ sync (ຮັບເຂົ້າສາງ · ໃບເບີກ · ໃບຮັບຄືນ) ຕ້ອງໃຫ້ cron ພາຍນອກຍິງ
 * `/api/cron/erp-dispatch` ທຸກ 5 ນາທີ ⇒ ຕ້ອງໄປຕັ້ງ scheduler ຢູ່ນອກລະບົບ, ຕ້ອງຈື່
 * ຕໍ່ອາຍຸ CRON_KEY, ແລະ **ຖ້າ cron ຕາຍກໍ່ບໍ່ມີໃຜຮູ້** — ວຽກຄ້າງຢູ່ "ກຳລັງສັ່ງຊື້"
 * ຫຼື "ລໍສາງເບີກ" ເປັນອາທິດໂດຍທີ່ ERP ເຮັດຄົບໄປແລ້ວ.
 *
 * ── ວິທີ ──
 * ໃຫ້ **ຄົນທີ່ເປີດໜ້າ** ເປັນຕົວກະຕຸ້ນແທນ cron ແຕ່ **ຄຸມດ້ວຍນາທີ**: ຮອບໜຶ່ງຕໍ່
 * `WINDOW_SECONDS` ທັງລະບົບ (ບໍ່ແມ່ນຕໍ່ຄົນ ບໍ່ແມ່ນຕໍ່ໜ້າ). ຄົນທີ 2-100 ທີ່ເປີດ
 * ພາຍໃນນາທີດຽວກັນ ເສຍພຽງ **1 UPDATE** ທີ່ບໍ່ຖືກແຖວ (~1ms) ⇒ ຕິດໃສ່ໜ້າຄິວໄດ້
 * ໂດຍບໍ່ຊ້າ (ຮອບຈິງ ~430ms ວັດ 06-08-2026 ຕອນບໍ່ມີໃບໃໝ່).
 *
 * ── ຈອງຮອບແບບ atomic ──
 * `on conflict do update ... where updated_at < now()-window` — **ຜູ້ຊະນະໄດ້ແຖວຄືນ
 * ຄົນດຽວ** ເຖິງ 10 ຄົນຈະເປີດພ້ອມກັນ ຫຼື ມີຫຼາຍ instance (Postgres ຈັດການລັອກແຖວໃຫ້)
 * ⇒ ບໍ່ມີ sync ຊ້ອນກັນ. ໃຊ້ໄດ້ທັງ serverless ທີ່ບໍ່ມີໜ່ວຍຄວາມຈຳຮ່ວມ.
 *
 * ── ຂໍ້ຕົກລົງ ──
 * ບໍ່ໂຍນ error ເດັດຂາດ — ERP ລົ້ມ ⇒ ໜ້າຈໍຍັງເປີດໄດ້ ພຽງແຕ່ເຫັນສະຖານະເກົ່າ
 * (ຫຼັກການດຽວກັບ syncErpDispatch). ຕົວ sync ທັງ 3 idempotent ⇒ ຍິງຊ້ຳບໍ່ເສຍຫາຍ.
 *
 * ⚠️ ໜ້າ**ໃບງານດ່ຽວ** ໃຫ້ໃຊ້ `syncErpDispatchForJob` ຄືເກົ່າ (ຖືກກວ່າ ແລະ ບໍ່ຖືກຈຳກັດ
 * ດ້ວຍນາທີ — ຄົນເປີດໃບງານຕ້ອງການເຫັນສະຖານະ**ໃບນັ້ນ**ດຽວນີ້).
 */
const KEY = "erp_sync_at";
const WINDOW_SECONDS = 60;

/**
 * ຈອງຮອບ — true = ເຮົາເປັນຜູ້ຊະນະ ຕ້ອງ sync, false = ຄົນອື່ນຫາກໍ່ sync ໄປ.
 * export ໄວ້ໃຫ້ `/api/sync/erp-dispatch` (ຕົວທີ່ browser ຍິງທຸກ 15 ວິ) ໃຊ້ຄຸມ
 * ສະເພາະ **syncErpPurchase** ທີ່ໜັກ ໂດຍທີ່ໃບເບີກ/ໃບຮັບຄືນຍັງກວດທຸກຮອບຄືເກົ່າ.
 */
export async function claimErpSyncSlot(): Promise<boolean> {
  if (!db) return false;
  try {
    const claimed = await db.query(
      `insert into ods_setting(key, value, updated_by, updated_at)
       values ($1, 'auto', 'system', localtimestamp(0))
       on conflict (key) do update set updated_at = localtimestamp(0)
        where ods_setting.updated_at < localtimestamp(0) - ($2 || ' seconds')::interval
       returning 1`,
      [KEY, String(WINDOW_SECONDS)],
    );
    return (claimed.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("erp sync slot failed", error);
    return false;
  }
}

/**
 * ເອີ້ນຢູ່ຫົວໜ້າຄິວທີ່ກ່ຽວກັບອາໄຫຼ່. ຮັບປະກັນວ່າ:
 * ① ບໍ່ເກີນ 1 ຮອບ/ນາທີ ⇒ ເປີດໜ້າຖີ່ປານໃດກໍ່ບໍ່ໜັກ
 * ② ບໍ່ໂຍນ error ⇒ ໜ້າຈໍບໍ່ພັງຕາມ ERP
 */
export async function syncErpOnView(): Promise<void> {
  if (!(await claimErpSyncSlot())) return;
  try {
    // ຮັບເຂົ້າສາງກ່ອນ — ວຽກທີ່ຖືກສະແຕມ spare_arrive ຮອບນີ້ ອາດມີໃບເບີກລໍຢູ່ແລ້ວ
    // ⇒ syncErpDispatch ທີ່ຮັນຕໍ່ຈະເຫັນແຖວຂອງມັນນຳ (ລຳດັບດຽວກັບ cron ເກົ່າ).
    await syncErpPurchase();
    await syncErpDispatch();
    await syncErpReturns();
  } catch (error) {
    console.error("syncErpOnView failed", error);
  }
}
