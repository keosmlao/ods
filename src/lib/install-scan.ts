import { db, query, queryOdg } from "@/lib/db";
import { logChange } from "@/lib/chatter-log";
import type { Session } from "@/lib/auth";

/**
 * **ISN/SN ຂອງງານຕິດຕັ້ງ — ຊ່າງເປັນຄົນເກັບມາ ບໍ່ແມ່ນ CS ພິມໄວ້ລ່ວງໜ້າ** (07-08-2026).
 *
 * ── ເປັນຫຍັງປ່ຽນ ──
 * ເມື່ອກ່ອນ CS ເລືອກ/ພິມ ISN ໃສ່ໃບງານຕອນເປີດງານ ແລ້ວແອັບເອົາມາທຽບຕອນຊ່າງຕິດ.
 * ຂໍ້ມູນຈິງບອກວ່າໃຊ້ບໍ່ໄດ້:
 *   • ເລກຂອງໜ່ວຍທີ່**ຈ່າຍອອກສາງ** (`sn_trans_detail` ຂອງໃບຈ່າຍ DPC…) ມັກເກີດ
 *     **ຫຼັງ**ເປີດໃບງານ ⇒ ຕອນເປີດງານຍັງບໍ່ມີເລກໃຫ້ໃສ່ (ວັດຈິງ CAK26009551:
 *     ຂາຍ 06-08 · ໃບຈ່າຍ 07-08 · ໃບງານເປີດ 06-08 ⇒ pro_sn ຫວ່າງ)
 *   • ພິມມືແລ້ວຜິດ: INST-7213 ກັບ INST-7214 (ບິນດຽວກັນ 2 ໜ່ວຍ) ໄດ້ເລກ**ອັນດຽວກັນ**
 *     ທັງທີ່ໃບຈ່າຍລົງໄວ້ 032A0013582 [C] ແລະ 032A0013977 [H] ຄົນລະໜ່ວຍ
 *
 * ⇒ ດຽວນີ້: ເປີດງານປະໄວ້**ຫວ່າງ** · ຊ່າງຢູ່ໜ້າງານຍິງ/ພິມເລກຈາກປ້າຍຕົວຈິງ ⇒ ລະບົບ
 * **ບັນທຶກໃສ່ໃບງານໃຫ້ເອງ** ແລ້ວຈຶ່ງຈົບງານໄດ້.
 *
 * ── ແອ = 2 ໜ່ວຍ = 2 ເລກ ──
 * ໃບຈ່າຍລົງແຍກ `[C]` ໜ່ວຍໃນ ແລະ `[H]` ໜ່ວຍນອກ (ຄົນລະ ISN) ⇒ ຕ້ອງເກັບໃຫ້ຄົບ
 * ທັງສອງກ່ອນຈົບງານ. ເຄື່ອງໃຊ້ໄຟຟ້າອື່ນ (ໂທລະທັດ · ຈັກຊັກ · ຕູ້ເຢັນ) = 1 ໜ່ວຍ.
 *
 * ── ບໍ່ຈຳເປັນຕ້ອງຕົງກັບໃບງານ — ເກັບເປັນປະຫວັດແທນ (08-08-2026 ຕາມຄຳສັ່ງ) ──
 * ແຕ່ກ່ອນ: ເລກທີ່ບໍ່ຢູ່ໃນໃບຈ່າຍຂອງບິນ ⇒ **ປະຕິເສດ**. ໜ້າງານຈິງມັນລົ້ມ: ສາງສັບໜ່ວຍ
 * ຕອນຈ່າຍ · ບິນຂາຍເປັນຊຸດແຕ່ຈ່າຍອອກຄົນລະລະຫັດ · ERP ບໍ່ໄດ້ລົງ ISN ບາງໜ່ວຍ
 * ⇒ ຊ່າງຢືນຢູ່ຕໍ່ໜ້າເຄື່ອງ ອ່ານປ້າຍໄດ້ ແຕ່ລະບົບບໍ່ຍອມຮັບ ⇒ ປິດງານບໍ່ໄດ້.
 *
 * ⇒ ດຽວນີ້ **ຮັບທຸກເລກ** (ປ້າຍຂອງເຄື່ອງທີ່ຕິດຈິງ = ຄວາມຈິງທີ່ສຸດ) ແລ້ວ**ບັນທຶກ
 * ປະຫວັດການອັບເດດ `pro_sn`/`pro_sn_out`**: ຄ່າເກົ່າ → ຄ່າໃໝ່ · ຕົງກັບບິນບໍ · ໃຜ ·
 * ເມື່ອໃດ · ຍິງ ຫຼື ພິມ (ຕາຕະລາງ `ods_install_scan` + chatter ຂອງໃບງານ).
 * ການທຽບກັບໃບຈ່າຍຍັງເຮັດຢູ່ ແຕ່ອອກມາເປັນ **ຄຳເຕືອນ** ບໍ່ແມ່ນດ່ານກັ້ນ ⇒ ຜູ້ຈັດການ
 * ຍັງເຫັນວ່າໃບໃດເລກບໍ່ຕົງກັບບິນ ແລະ ຕາມແກ້ພາຍຫຼັງໄດ້.
 *
 * ── ຮັບເລກໄດ້ 2 ແບບ · ໄດ້ 2 ທາງ ──
 * ① ISN (ປ້າຍ ODIEN) ② SN ໂຮງງານ — ແປງຫາກັນຜ່ານ `sn_inventory`.
 * ຍິງກ້ອງ (ທາງຫຼັກ) ຫຼື ພິມເອງ — ພິມເອງກໍ່ຖືກທຽບຄືກັນ ພຽງແຕ່ໝາຍໄວ້ໃນປະຫວັດ.
 */

export type ScanPhase = "install" | "finish";

export type ScanResult =
  | {
      ok: true;
      /** ຊ່ອງທີ່ລົງ — indoor = `pro_sn` · outdoor = `pro_sn_out` */
      matched: "indoor" | "outdoor";
      isn: string | null;
      sn: string | null;
      message: string;
      /** ຮັບໄວ້ແລ້ວ ແຕ່ບໍ່ຕົງກັບບິນ/ຄ່າເກົ່າ — ຫວ່າງ = ຕົງດີ */
      warning: string | null;
    }
  | { ok: false; error: string };

/** ຕັດຍະຫວ່າງ/ຂີດ ແລະ ເປັນຕົວພິມໃຫຍ່ — ປ້າຍພິມຄົນລະຮູບແບບ ແຕ່ເປັນເລກອັນດຽວກັນ */
const norm = (value: string | null | undefined) => (value ?? "").replace(/[\s-]/g, "").toUpperCase();

/**
 * ຄ່າທີ່ **ບໍ່ແມ່ນເລກຈິງ** — ຂໍ້ມູນເກົ່າໃສ່ "-" ຫຼື "N/A" ແທນການປະຫວ່າງ
 * ⇒ ຖ້າບໍ່ກັນໄວ້ ຈະໄປທຽບກັບ "-" ແລ້ວແຈ້ງວ່າ "ບໍ່ຕົງກັບໃບງານ" ທັງທີ່ໃບງານບໍ່ໄດ້ລະບຸ.
 */
const realSerial = (value: string | null | undefined) => {
  const clean = norm(value);
  return clean && clean !== "N/A" && clean !== "NA" ? clean : "";
};

type Job = {
  pro_sn: string | null;
  pro_sn_out: string | null;
  item_code: string | null;
  doc_ref_1: string | null;
};

/** ໜ່ວຍທີ່ຂາຍໃນບິນ — ມາຈາກ**ໃບຈ່າຍສິນຄ້າອອກສາງ** ທີ່ອ້າງອີງບິນນັ້ນ */
type IssuedUnit = { isn: string; sn: string | null; part: "indoor" | "outdoor" };

async function loadJob(code: string): Promise<Job | null> {
  return (
    (
      await query<Job>(
        `select nullif(pro_sn,'') pro_sn, nullif(pro_sn_out,'') pro_sn_out,
            nullif(item_code,'') item_code, nullif(doc_ref_1,'') doc_ref_1
           from ods_tb_install where code = $1 limit 1`,
        [code],
      )
    ).rows[0] ?? null
  );
}

/**
 * ISN ທີ່ **ຈ່າຍອອກສາງ** ໃຫ້ບິນນີ້ — `sn_trans_detail.doc_ref = ເລກບິນ`
 * (ແຖວຢູ່ໃບຈ່າຍ DPC… ແຕ່ອ້າງບິນ CAK… ⇒ ຄົ້ນດ້ວຍ doc_ref).
 *
 * ⚠️ ແອ: ISN ຢູ່**ອົງປະກອບຂອງຊຸດ** ບໍ່ແມ່ນແຖວ [SET] ⇒ ຮັບທັງລະຫັດຂອງງານ ແລະ
 * ລະຫັດລູກຂອງມັນ (ic_inventory_set_detail) ຄືກັນກັບ api/installations/bills.
 *
 * ⚠️ `sn_trans_detail` ບໍ່ມີ index ຢູ່ doc_ref ⇒ seq scan ~0.5 ວິ. ຮັບໄດ້ເພາະເອີ້ນ
 * ສະເພາະຕອນຊ່າງຍິງ / ກົດຈົບງານ — ບໍ່ແມ່ນທຸກຄັ້ງທີ່ໂຫຼດລາຍການວຽກ.
 */
async function issuedUnits(job: Job): Promise<IssuedUnit[]> {
  if (!job.doc_ref_1 || !job.item_code) return [];
  try {
    return (
      await queryOdg<IssuedUnit>(
        `select d.sn as isn, nullif(sni.sn,'') as sn,
            case when d.item_name like '%[H]%' then 'outdoor' else 'indoor' end as part
           from sn_trans_detail d
           left join sn_inventory sni on sni.isn = d.sn
          where d.trans_flag = 44 and d.doc_ref = $1 and coalesce(d.sn,'') <> ''
            and (d.item_code = $2
                 or d.item_code in (select sd.ic_code from ic_inventory_set_detail sd
                                     where sd.ic_set_code = $2))`,
        [job.doc_ref_1, job.item_code],
      )
    ).rows;
  } catch (error) {
    // ERP ລົ້ມ ⇒ ບໍ່ມີຫຍັງໃຫ້ທຽບ (ຊ່າງຍັງເກັບເລກໄດ້ ພ້ອມໝາຍໄວ້ໃນປະຫວັດ)
    console.error("issuedUnits failed", job.doc_ref_1, error);
    return [];
  }
}

/**
 * ແປງຄ່າທີ່ໄດ້ເປັນຄູ່ (isn, sn) ຈາກ ERP.
 * ຫາບໍ່ພົບ ⇒ ຄືນຄ່າດິບເປັນ sn ໄວ້ (ເຄື່ອງທີ່ບໍ່ໄດ້ຜ່ານລະບົບ ISN ຍັງເກັບໄດ້).
 */
async function resolveSerial(raw: string): Promise<{ isn: string | null; sn: string | null }> {
  const value = raw.trim();
  if (!value) return { isn: null, sn: null };
  try {
    const row = (
      await queryOdg<{ isn: string | null; sn: string | null }>(
        `select nullif(isn,'') isn, nullif(sn,'') sn from sn_inventory
          where replace(replace(upper(coalesce(isn,'')),' ',''),'-','') = $1
             or replace(replace(upper(coalesce(sn,'')),' ',''),'-','') = $1
          limit 1`,
        [norm(value)],
      )
    ).rows[0];
    return { isn: row?.isn ?? null, sn: row?.sn ?? value };
  } catch (error) {
    // ERP ລົ້ມ ⇒ ຍັງເກັບດ້ວຍຄ່າດິບໄດ້ (ຢ່າໃຫ້ຊ່າງຕິດຢູ່ໜ້າງານ)
    console.error("resolveSerial failed", value, error);
    return { isn: null, sn: value };
  }
}

/** ງານນີ້ຕ້ອງເກັບຈັກໜ່ວຍ ແລະ ເກັບໄດ້ແລ້ວຈັກໜ່ວຍ */
export type UnitState = {
  /** ໜ່ວຍນອກ (ແອ) ຕ້ອງມີບໍ */
  needOutdoor: boolean;
  indoor: string | null;
  outdoor: string | null;
  /** ຍັງຂາດຫຍັງແດ່ — ຫວ່າງ = ຄົບແລ້ວ */
  missing: string[];
};

/**
 * ຕ້ອງເກັບຈັກໜ່ວຍ — ຖາມ**ໃບຈ່າຍສິນຄ້າ**ກ່ອນ (ຄວາມຈິງທີ່ສຸດ), ບໍ່ມີຂໍ້ມູນຈຶ່ງເດົາຈາກ
 * ລະຫັດສິນຄ້າ (12xx = ແອ ⇒ 2 ໜ່ວຍ). ເອົາໄວ້ບ່ອນດຽວ ໃຫ້ດ່ານຈົບງານກັບໜ້າຈໍແອັບ
 * ບອກຄືກັນສະເໝີ.
 */
export async function installUnits(code: string): Promise<UnitState | null> {
  const job = await loadJob(code);
  if (!job) return null;
  const units = await issuedUnits(job);
  const needOutdoor = units.length
    ? units.some((unit) => unit.part === "outdoor")
    : (job.item_code ?? "").startsWith("12");
  const indoor = realSerial(job.pro_sn) ? job.pro_sn : null;
  const outdoor = realSerial(job.pro_sn_out) ? job.pro_sn_out : null;
  const missing: string[] = [];
  if (!indoor) missing.push(needOutdoor ? "ໜ່ວຍໃນ" : "ຕົວເຄື່ອງ");
  if (needOutdoor && !outdoor) missing.push("ໜ່ວຍນອກ");
  return { needOutdoor, indoor, outdoor, missing };
}

/**
 * ເກັບ ISN-SN ຂອງໜ່ວຍທີ່**ຕິດຈິງ** ໃສ່ໃບງານ — ຮັບທຸກເລກ, ບໍ່ບລັອກຊ່າງ.
 *
 * ຊ່ອງຫວ່າງ ⇒ ບັນທຶກ · ຊ່ອງມີເລກຢູ່ແລ້ວ ແລະ ໄດ້ມາຄົນລະເລກ ⇒ **ທັບ ພ້ອມເກັບຄ່າເກົ່າ
 * ໄວ້ໃນປະຫວັດ** (ຄ່າເກົ່າມາຈາກການເດົາ/ພິມມື — ເລກຢູ່ປ້າຍເຄື່ອງທີ່ຕິດແມ່ນຂອງຈິງ).
 * ບໍ່ຕົງກັບໃບຈ່າຍຂອງບິນ ⇒ ຮັບໄວ້ຄືກັນ ແຕ່ໝາຍ `mismatch` ໄວ້ໃຫ້ຜູ້ຈັດການຕາມເບິ່ງ.
 *
 * `options.part` = ຊ່າງເລືອກເອງວ່າກຳລັງເກັບໜ່ວຍໃນ ຫຼື ໜ່ວຍນອກ (ແອ 2 ໜ່ວຍ) —
 * ບໍ່ສົ່ງມາ ⇒ ຄິດໃຫ້ເອງ: ຕົງກັບບິນ ⇒ ຕາມບິນ · ບໍ່ດັ່ງນັ້ນລົງຊ່ອງທີ່ຫວ່າງກ່ອນ.
 */
export async function recordInstallScan(
  session: Session,
  code: string,
  raw: string,
  phase: ScanPhase,
  options: { manual?: boolean; part?: "indoor" | "outdoor" | null } = {},
): Promise<ScanResult> {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "ບໍ່ໄດ້ເລກ ISN/SN — ລອງຍິງໃໝ່ ຫຼື ພິມເອງ" };

  const job = await loadJob(code);
  if (!job) return { ok: false, error: "ບໍ່ພົບໃບງານນີ້" };

  const { isn, sn } = await resolveSerial(value);
  const candidates = [norm(value), norm(isn), norm(sn)].filter(Boolean);
  const units = await issuedUnits(job);
  const indoorSet = realSerial(job.pro_sn);
  const outdoorSet = realSerial(job.pro_sn_out);
  const needOutdoor = units.length
    ? units.some((unit) => unit.part === "outdoor")
    : (job.item_code ?? "").startsWith("12");

  // ── ໜ່ວຍນີ້ຢູ່ໃນໃບຈ່າຍຂອງບິນນີ້ບໍ (ໃຊ້ຈັດຊ່ອງ ແລະ ອອກຄຳເຕືອນ — ບໍ່ແມ່ນດ່ານກັ້ນ) ──
  const hit = units.find(
    (unit) => candidates.includes(norm(unit.isn)) || candidates.includes(norm(unit.sn)),
  );

  /**
   * ລົງຊ່ອງໃດ — ຕາມລຳດັບຄວາມແນ່ນອນ:
   *   ① ຊ່າງເລືອກເອງໃນແອັບ (ຮູ້ດີກວ່າໃຜ ວ່າກຳລັງຢືນຢູ່ໜ້າໜ່ວຍໃນ ຫຼື ໜ່ວຍນອກ)
   *   ② ໃບຈ່າຍບອກ ([C] ໃນ · [H] ນອກ)
   *   ③ ຕົງກັບຄ່າທີ່ໃບງານມີຢູ່ແລ້ວ = ຢືນຢັນຊ້ຳຊ່ອງນັ້ນ
   *   ④ ບໍ່ມີຫຍັງໃຫ້ອີງ ⇒ ລົງຊ່ອງທີ່ຫວ່າງກ່ອນ (ໃນ → ນອກ), ເຕັມໝົດ ⇒ ທັບໜ່ວຍໃນ
   */
  const part: "indoor" | "outdoor" =
    options.part === "indoor" || options.part === "outdoor"
      ? options.part
      : hit
        ? hit.part
        : indoorSet && candidates.includes(indoorSet)
          ? "indoor"
          : outdoorSet && candidates.includes(outdoorSet)
            ? "outdoor"
            : !indoorSet
              ? "indoor"
              : needOutdoor && !outdoorSet
                ? "outdoor"
                : "indoor";

  /**
   * ດ່ານດຽວທີ່ຍັງເຫຼືອ — **ເລກອັນດຽວລົງ 2 ຊ່ອງບໍ່ໄດ້**. ບໍ່ແມ່ນການບັງຄັບໃຫ້ຕົງກັບໃບງານ
   * ແຕ່ເປັນຄວາມຂັດແຍ້ງໃນຕົວມັນເອງ (ໜ່ວຍໃນ ກັບ ໜ່ວຍນອກ ເປັນເຄື່ອງຄົນລະໜ່ວຍ) —
   * ຮູເກົ່າທີ່ເຮັດໃຫ້ INST-7213/7214 ໄດ້ເລກຊ້ຳກັນ. ບອກໃຫ້ຊ່າງຮູ້ ແລ້ວຍິງໃໝ່.
   */
  const other = part === "indoor" ? outdoorSet : indoorSet;
  if (other && candidates.includes(other)) {
    const otherWhere = part === "indoor" ? "ໜ່ວຍນອກ" : "ໜ່ວຍໃນ";
    return {
      ok: false,
      error: `ເລກນີ້ລົງເປັນ${otherWhere}ຂອງໃບນີ້ຢູ່ແລ້ວ — ໜ່ວຍໃນ ກັບ ໜ່ວຍນອກ ຕ້ອງຄົນລະເລກ`,
    };
  }

  const current = part === "indoor" ? indoorSet : outdoorSet;
  const currentRaw = (part === "indoor" ? job.pro_sn : job.pro_sn_out) ?? "";
  const where = part === "indoor" ? "ໜ່ວຍໃນ" : "ໜ່ວຍນອກ";
  const label = sn && sn !== value ? `${sn}${isn ? ` (ISN ${isn})` : ""}` : value;
  // ຄ່າທີ່ລົງໃບງານ — ຢາກໄດ້ SN ໂຮງງານ (ERP ຮູ້ຈັກ) ບໍ່ດັ່ງນັ້ນເອົາຄ່າດິບທີ່ຍິງມາ
  const saved = sn ?? value;

  const replaced = Boolean(current) && !candidates.includes(current);

  /**
   * ບໍ່ຕົງກັບບິນ ຫຼື ທັບຄ່າເກົ່າ = ບໍ່ໄດ້ຫ້າມ ແຕ່ຕ້ອງ**ຕາມເບິ່ງພາຍຫຼັງໄດ້**
   * (ຜູ້ຈັດການກອງດ້ວຍ `mismatch` ຢູ່ ods_install_scan).
   */
  const offBill = units.length > 0 && !hit;
  const warning = offBill
    ? `⚠️ ບໍ່ຢູ່ໃນໃບຈ່າຍຂອງບິນ ${job.doc_ref_1} (ບິນຈ່າຍ ` +
      `${units.map((unit) => `${unit.isn}${unit.part === "outdoor" ? " (ນອກ)" : ""}`).join(" · ")}) — ຮັບໄວ້ຕາມເຄື່ອງທີ່ຕິດຈິງ`
    : units.length === 0
      ? "⚠️ ບິນບໍ່ໄດ້ລົງ ISN ໄວ້ ຈຶ່ງທຽບບໍ່ໄດ້"
      : null;

  /**
   * ── ລົງໃບງານ + ລົງປະຫວັດ = ຄັ້ງດຽວກັນ ──
   * ແຍກກັນບໍ່ໄດ້: ຖ້າ update ຜ່ານ ແຕ່ແຖວປະຫວັດລົ້ມ ⇒ `pro_sn` ຂອງໃບງານປ່ຽນໄປ
   * **ໂດຍບໍ່ມີໃຜຮູ້ວ່າໃຜປ່ຽນ ຈາກຄ່າຫຍັງ** ຊຶ່ງແມ່ນສິ່ງດຽວທີ່ຄຸນສົມບັດນີ້ຮັບປະກັນໄວ້.
   */
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  try {
    await client.query("begin");
    if (!current || replaced) {
      const column = part === "indoor" ? "pro_sn" : "pro_sn_out";
      await client.query(`update ods_tb_install set ${column}=$2, user_edit=$3 where code=$1`, [
        code,
        saved,
        session.username,
      ]);
    }
    await client.query(
      `insert into ods_install_scan(job_code, phase, scanned, matched, isn, sn, tech_code,
          prev_value, saved_value, mismatch)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        code,
        phase,
        value.slice(0, 60),
        part,
        isn,
        sn,
        session.username,
        currentRaw.slice(0, 60) || null,
        saved.slice(0, 60),
        offBill || replaced,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  // ຍິງກ້ອງ ຫຼື ພິມເອງ — ຫຼັກຖານໜັກບໍ່ເທົ່າກັນ ⇒ ຂຽນຄົນລະຄຳໃນປະຫວັດ
  const how = options.manual ? "ປ້ອນເລກເອງ" : "ສະແກນ";
  // ປະຫວັດການອັບເດດ pro_sn/pro_sn_out — ຄ່າເກົ່າ → ຄ່າໃໝ່ ພ້ອມຜົນການທຽບກັບບິນ
  const note = [
    replaced
      ? `ແກ້ຈາກ ${currentRaw} ⇒ ${saved}`
      : current
        ? "ຢືນຢັນຊ້ຳ — ຄືເກົ່າ"
        : `ບັນທຶກໃສ່ໃບງານ ${saved}`,
    warning ?? "ຕົງກັບໜ່ວຍທີ່ຈ່າຍໃນບິນ",
  ].join(" · ");
  await logChange("ods_tb_install", code, `${how} ${where}: ${label} — ${note}`, {
    author: session.username,
  });

  return {
    ok: true,
    matched: part,
    isn,
    sn,
    warning,
    message:
      (replaced
        ? `ແກ້${where} ຈາກ ${currentRaw} ເປັນ ${label}`
        : current
          ? `ຢືນຢັນ${where}ແລ້ວ — ${label}`
          : `ບັນທຶກ${where}ແລ້ວ — ${label}`) + (warning ? ` ${warning}` : ""),
  };
}

/**
 * **ປະຫວັດການອັບເດດ ISN/SN ຂອງໃບງານນີ້** (ໃຫ້ໜ້າໃບງານ ແລະ ແອັບ ສະແດງ) —
 * ແຕ່ລະແຖວ = 1 ຄັ້ງທີ່ຊ່າງເກັບເລກ: ຄ່າເກົ່າ → ຄ່າທີ່ລົງໃບງານ · ຕົງກັບບິນບໍ (`mismatch`).
 */
export async function installScans(code: string) {
  return (
    await query<{
      id: number;
      phase: string;
      scanned: string;
      matched: string;
      isn: string | null;
      sn: string | null;
      tech_code: string | null;
      scanned_at: string;
      prev_value: string | null;
      saved_value: string | null;
      mismatch: boolean;
    }>(
      `select id, phase, scanned, matched, isn, sn, tech_code,
          prev_value, saved_value, coalesce(mismatch,false) mismatch,
          to_char(scanned_at,'DD-MM-YYYY HH24:MI') scanned_at
        from ods_install_scan where job_code = $1 order by id`,
      [code],
    )
  ).rows;
}
