/**
 * **"ຜູ້ເຮັດຕໍ່" ຂອງວຽກສ້ອມ — ນິຍາມບ່ອນດຽວທົ່ວລະບົບ.**
 *
 * ສູນວຽກງານສ້ອມ (/work/repair) · ຄິວຂັ້ນເກົ່າ · ໜ້າວຽກ /service/[code] · API ມືຖື
 * ຖາມຄຳຕອບອັນດຽວກັນ: ວຽກນີ້ **ໃຜຕ້ອງລົງມືຕໍ່** ແລະ ເຮັດຫຍັງ.
 *
 * ── ເອກະສານເປັນຄວາມຈິງ ──
 * ຂັ້ນ (STAGE_SQL) ຄິດຈາກທຸງວຽກ ແຕ່ສະຖານະອາໄຫຼ່ຄິດຈາກ **ແຖວ SIO** (ເບີກ/ສັ່ງຊື້
 * ຫຼາຍຮອບ ⇒ ທຸງດຽວບໍ່ພໍ — ເບິ່ງ lib/repair-spare-rounds). ດັ່ງນັ້ນໃນຊ່ວງຂັ້ນ 5-9
 * ແຖວທີ່ຍັງຄ້າງ **ຊະນະ** ຂັ້ນ: ມີແຖວ status=5 ຍັງບໍ່ມາຮອດ ⇒ ຈັດຊື້ · ມີແຖວພ້ອມເບີກ ⇒ ສາງ.
 *
 * ⚠️ ໄຟລ໌ນີ້ **ບໍ່ມີ import ຈັກອັນ** — tests/*.test.mts ເອີ້ນມັນໂດຍກົງຜ່ານ
 * node --experimental-strip-types (ບໍ່ມີ bundler ແກ້ "@/…") ຈຶ່ງຕ້ອງພໍພຽງຕົວເອງ.
 * ຄ່າຖັນ 0/5 ຕ້ອງຕົງກັບ LINE_STATUS ໃນ lib/stock-constants — ຜູກໄວ້ດ້ວຍ contract
 * test ໃນ tests/repair-next-action.test.mts.
 */

export type RepairActor = "cs" | "tech" | "stock" | "purchase" | "qc";

/** ປ້າຍ "ຜູ້ເຮັດຕໍ່" ທີ່ສະແດງໃນໜ້າຈໍ */
export const ACTOR_LABEL: Record<RepairActor, string> = {
  cs: "ຝ່າຍຮັບ/CS",
  tech: "ຊ່າງ",
  stock: "ສາງ",
  purchase: "ຈັດຊື້",
  qc: "QC",
};

/** ຄ່າ status ແຖວ ic_trans_detail — ຕ້ອງຕົງກັບ LINE_STATUS (lib/stock-constants) */
const LINE_PENDING = 0; // ລໍສາງເບີກ
const LINE_ON_ORDER = 5; // ຢູ່ໃບສັ່ງຊື້ (ມາຮອດເມື່ອ ERP ສະແຕມ arrive_at)

/**
 * ຍອດລວມແຖວ SIO ຂອງວຽກ — ຜູ້ເອີ້ນສ້າງຈາກແຖວຈິງ (ສູນວຽກ/API ຖາມຈາກ
 * `ic_trans_detail where trans_flag = 122`) ແລ້ວສົ່ງໃຫ້ nextActor().
 */
export type SpareSummary = {
  /** ແຖວ status=0 — ໃບຂໍເບີກອອກແລ້ວ ລໍສາງຈ່າຍ */
  pending: number;
  /** ແຖວ status=5 ທີ່ arrive_at ຫວ່າງ — ຂອງຍັງບໍ່ມາຮອດ (ກຳລັງສັ່ງຊື້) */
  onOrder: number;
  /** ແຖວ status=5 ທີ່ມີ arrive_at — ຂອງມາຮອດສາງແລ້ວ ລໍເບີກ */
  arrived: number;
};

/** ແຖວ SIO ໜຶ່ງແຖວ ໃນຮູບທີ່ nextActor ຕ້ອງການ (ໃຊ້ກັບ summarizeSpareLines) */
export type SpareLineState = { status: number | null; arrived: boolean };

export type NextAction = {
  actor: RepairActor;
  /** ຊື່ຜູ້ເຮັດຕໍ່ ສຳລັບສະແດງ (ACTOR_LABEL[actor]) */
  actorLabel: string;
  /** ສະຖານະວຽກ ເຊັ່ນ "ອາໄຫຼ່ກຳລັງສັ່ງຊື້" */
  label: string;
  /** ຂໍ້ຄວາມປຸ່ມ action ຫຼັກ ເຊັ່ນ "ເບີກອາໄຫຼ່" */
  action: string;
};

const action = (actor: RepairActor, label: string, act: string): NextAction => ({
  actor,
  actorLabel: ACTOR_LABEL[actor],
  label,
  action: act,
});

/** ນັບແຖວ SIO ລົງ SpareSummary — ນິຍາມດຽວກັນທັງເວັບ ແລະ ມືຖື */
export function summarizeSpareLines(lines: readonly SpareLineState[]): SpareSummary {
  const summary: SpareSummary = { pending: 0, onOrder: 0, arrived: 0 };
  for (const line of lines) {
    const status = line.status ?? LINE_PENDING;
    if (status === LINE_ON_ORDER) {
      if (line.arrived) summary.arrived += 1;
      else summary.onOrder += 1;
    } else if (status === LINE_PENDING) {
      summary.pending += 1;
    }
  }
  return summary;
}

/**
 * ໃຜຕ້ອງເຮັດຫຍັງຕໍ່ ກັບວຽກຂັ້ນນີ້.
 *
 * - ຂັ້ນ 0-11 ຂອງງານສ້ອມປົກກະຕິ ຈຶ່ງມີຄຳຕອບ; ນອກນັ້ນ (ຍົກເລີກ · ສົ່ງຄືນແລ້ວ ·
 *   ເຄມ 13-16) ຄືນ `null` — ບໍ່ມີຜູ້ເຮັດຕໍ່ໃນສາຍງານສ້ອມ.
 * - ຂັ້ນ 5-9: ແຖວທີ່ຍັງຄ້າງຊະນະຂັ້ນ (ເອກະສານເປັນຄວາມຈິງ).
 */
export function nextActor(
  stage: number,
  spare?: SpareSummary | null,
  serviceType?: string | null,
): NextAction | null {
  if (spare && stage >= 5 && stage <= 9) {
    if (spare.onOrder > 0) return action("purchase", "ອາໄຫຼ່ກຳລັງສັ່ງຊື້", "ຕິດຕາມການສັ່ງຊື້");
    if (spare.pending + spare.arrived > 0) return action("stock", "ອາໄຫຼ່ພ້ອມເບີກ", "ເບີກອາໄຫຼ່");
  }
  switch (stage) {
    // PS ໄປຮັບເຄື່ອງບ້ານລູກຄ້າ · IH ລໍນັດໝາຍ/ຈັດຊ່າງໄປສ້ອມ (ຂັ້ນຍ່ອຍຂອງຂັ້ນ 0)
    case 0:
      return serviceType === "IH"
        ? action("cs", "ລໍນັດໝາຍ/ຈັດຊ່າງໄປສ້ອມ", "ນັດໝາຍ/ຈັດຊ່າງ")
        : action("cs", "ລໍໄປຮັບເຄື່ອງ", "ໄປຮັບເຄື່ອງ");
    case 1:
      return action("cs", "ລໍຖ້າກວດເຊັກ", "ຮັບງານ/ກວດເຊັກ");
    case 2:
      return action("tech", "ກຳລັງກວດເຊັກ", "ກວດເຊັກຕໍ່");
    case 3:
      return action("tech", "ລໍຖ້າສະເໜີລາຄາ", "ສະເໜີລາຄາ");
    case 4:
      return action("tech", "ກຳລັງສະເໜີລາຄາ", "ຕິດຕາມລາຄາ");
    case 5:
      return action("tech", "ກວດ Stock / ຂໍເບີກ", "ຂໍເບີກອາໄຫຼ່");
    case 6:
      return action("stock", "ກຳລັງເບີກອາໄຫຼ່", "ເບີກອາໄຫຼ່");
    case 7:
      return action("purchase", "ກຳລັງສັ່ງຊື້ອາໄຫຼ່", "ຕິດຕາມການສັ່ງຊື້");
    case 8:
      return action("tech", "ລໍຖ້າສ້ອມ", "ເລີ່ມສ້ອມ");
    case 9:
      return action("tech", "ກຳລັງສ້ອມ", "ຈົບການສ້ອມ");
    case 10:
      return action("qc", "ລໍກວດຮັບຄຸນນະພາບ", "ກວດຮັບ QC");
    case 11:
      return serviceType === "IH"
        ? action("cs", "ລໍປິດງານ", "ປິດງານ")
        : action("cs", "ລໍຖ້າສົ່ງຄືນ", "ສົ່ງຄືນ/ປິດງານ");
    default:
      return null;
  }
}
