import { db, query } from "@/lib/db";
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
 *
 * ⇒ ດຽວນີ້: ເປີດງານປະໄວ້**ຫວ່າງ** · ຊ່າງຢູ່ໜ້າງານຍິງ/ພິມເລກຈາກປ້າຍຕົວຈິງ ⇒ ລະບົບ
 * **ບັນທຶກໃສ່ໃບງານໃຫ້ເອງ** ແລ້ວຈຶ່ງຈົບງານໄດ້.
 *
 * ── ຍິງແລ້ວ**ລົງເລີຍ** ບໍ່ຕ້ອງກັບໄປກວດສອບ (08-08-2026 ຕາມຄຳສັ່ງ) ──
 * ຮຸ່ນກ່ອນເອົາຄ່າທີ່ຍິງໄດ້ໄປຖາມ ERP 2 ຮອບ (`sn_inventory` ແປງ ISN↔SN ·
 * `sn_trans_detail` ຫາໜ່ວຍທີ່ຈ່າຍໃຫ້ບິນ) ແລ້ວຈຶ່ງຕັດສິນວ່າຮັບ ຫຼື ປະຕິເສດ. ຖິ້ມແລ້ວ:
 *   • ບໍ່ມີປະໂຫຍດ — ຮັບທຸກເລກຢູ່ແລ້ວ (ປ້າຍຂອງເຄື່ອງທີ່ຕິດຈິງ = ຄວາມຈິງທີ່ສຸດ)
 *   • ຊ້າຢູ່ໜ້າງານ — `sn_trans_detail` ບໍ່ມີ index ຢູ່ `doc_ref` ⇒ seq scan ~0.5 ວິ
 *     ຕໍ່ 1 ຄັ້ງທີ່ຍິງ, ບວກກັບເນັດ 3G ໜ້າງານ
 *   • ERP ລົ້ມ/ຊ້າ ⇒ ຊ່າງຄາ ທັງທີ່ວຽກນີ້ບໍ່ຕ້ອງເພິ່ງ ERP ຈັກໜ້ອຍ
 *
 * ⇒ ດຽວນີ້: ຂຽນຄ່າທີ່ໄດ້ລົງ `pro_sn`/`pro_sn_out` ຕົງໆ + ເກັບ**ປະຫວັດການອັບເດດ**
 * (ຄ່າເກົ່າ → ຄ່າໃໝ່ · ໃຜ · ເມື່ອໃດ · ຍິງ ຫຼື ພິມ) ໄວ້ 2 ບ່ອນ: ຕາຕະລາງ
 * `ods_install_scan` ແລະ chatter ຂອງໃບງານ ⇒ ຜູ້ຈັດການຕາມກວດຍ້ອນຫຼັງໄດ້ຄືເກົ່າ.
 * ຢາກທຽບກັບໃບຈ່າຍ ⇒ ເຮັດຢູ່ຝັ່ງເວັບ ບ່ອນທີ່ຊ້າແດ່ກໍ່ບໍ່ມີໃຜຄາຢູ່ໜ້າງານ.
 *
 * ── ແອ = 2 ໜ່ວຍ = 2 ເລກ ──
 * ໜ່ວຍໃນ (`pro_sn`) ແລະ ໜ່ວຍນອກ (`pro_sn_out`) ຄົນລະເລກ ⇒ ຕ້ອງເກັບໃຫ້ຄົບທັງສອງ
 * ກ່ອນຈົບງານ. ເຄື່ອງໃຊ້ໄຟຟ້າອື່ນ (ໂທລະທັດ · ຈັກຊັກ · ຕູ້ເຢັນ) = 1 ໜ່ວຍ.
 * ຊ່າງເລືອກເອງໃນແອັບວ່າກຳລັງເກັບໜ່ວຍໃດ (`part`) — ບໍ່ໄດ້ເລືອກ ⇒ ລົງຊ່ອງທີ່ຫວ່າງກ່ອນ.
 */

export type ScanPhase = "install" | "finish";

export type ScanResult =
  | {
      ok: true;
      /** ຊ່ອງທີ່ລົງ — indoor = `pro_sn` · outdoor = `pro_sn_out` */
      matched: "indoor" | "outdoor";
      message: string;
    }
  | { ok: false; error: string };

/** ຕັດຍະຫວ່າງ/ຂີດ ແລະ ເປັນຕົວພິມໃຫຍ່ — ໃຊ້ທຽບວ່າ "ເລກເກົ່າກັບເລກໃໝ່ແມ່ນອັນດຽວກັນບໍ" */
const norm = (value: string | null | undefined) => (value ?? "").replace(/[\s-]/g, "").toUpperCase();

/**
 * ຄ່າທີ່ **ບໍ່ແມ່ນເລກຈິງ** — ຂໍ້ມູນເກົ່າໃສ່ "-" ຫຼື "N/A" ແທນການປະຫວ່າງ
 * ⇒ ຖ້າບໍ່ກັນໄວ້ ຈະນັບວ່າ "ຊ່ອງນີ້ມີເລກແລ້ວ" ທັງທີ່ໃບງານບໍ່ໄດ້ລະບຸ.
 */
const realSerial = (value: string | null | undefined) => {
  const clean = norm(value);
  return clean && clean !== "N/A" && clean !== "NA" ? clean : "";
};

type Job = {
  pro_sn: string | null;
  pro_sn_out: string | null;
  item_code: string | null;
};

async function loadJob(code: string): Promise<Job | null> {
  return (
    (
      await query<Job>(
        `select nullif(pro_sn,'') pro_sn, nullif(pro_sn_out,'') pro_sn_out,
            nullif(item_code,'') item_code
           from ods_tb_install where code = $1 limit 1`,
        [code],
      )
    ).rows[0] ?? null
  );
}

/**
 * ງານນີ້ຕ້ອງມີໜ່ວຍນອກບໍ — **ລະຫັດສິນຄ້າ 12xx = ແອ** (2 ໜ່ວຍ).
 * ກົດດຽວກັນກັບ `lib/mobile-jobs` (`need_outdoor`) ⇒ ປຸ່ມໃນແອັບ ກັບ ດ່ານຈົບງານ
 * ບອກຄືກັນສະເໝີ ໂດຍບໍ່ຕ້ອງຖາມ ERP.
 */
const needsOutdoor = (job: Job) => (job.item_code ?? "").startsWith("12");

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
 * ຕ້ອງເກັບຈັກໜ່ວຍ — ເອົາໄວ້ບ່ອນດຽວ ໃຫ້ດ່ານຈົບງານກັບໜ້າຈໍແອັບບອກຄືກັນສະເໝີ.
 */
export async function installUnits(code: string): Promise<UnitState | null> {
  const job = await loadJob(code);
  if (!job) return null;
  const needOutdoor = needsOutdoor(job);
  const indoor = realSerial(job.pro_sn) ? job.pro_sn : null;
  const outdoor = realSerial(job.pro_sn_out) ? job.pro_sn_out : null;
  const missing: string[] = [];
  if (!indoor) missing.push(needOutdoor ? "ໜ່ວຍໃນ" : "ຕົວເຄື່ອງ");
  if (needOutdoor && !outdoor) missing.push("ໜ່ວຍນອກ");
  return { needOutdoor, indoor, outdoor, missing };
}

/**
 * **ເກັບ ISN/SN ຂອງໜ່ວຍທີ່ຕິດຈິງ ໃສ່ໃບງານ** — ຮັບທຸກເລກ ບໍ່ທຽບກັບຫຍັງ.
 *
 * ຊ່ອງຫວ່າງ ⇒ ລົງ · ຊ່ອງມີເລກຢູ່ແລ້ວ ແລະ ໄດ້ມາຄົນລະເລກ ⇒ **ທັບ ພ້ອມເກັບຄ່າເກົ່າ
 * ໄວ້ໃນປະຫວັດ** · ເລກເກົ່າອັນເກົ່າ ⇒ ບໍ່ຂຽນຊ້ຳ ແຕ່ຍັງລົງປະຫວັດວ່າຢືນຢັນແລ້ວ.
 *
 * `options.part` = ຊ່າງເລືອກເອງໃນແອັບ (ແອ 2 ໜ່ວຍ) — ບໍ່ສົ່ງມາ ⇒ ຄິດໃຫ້ເອງ:
 * ຕົງກັບຊ່ອງໃດຢູ່ແລ້ວ ⇒ ຊ່ອງນັ້ນ · ບໍ່ດັ່ງນັ້ນລົງຊ່ອງທີ່ຫວ່າງກ່ອນ (ໃນ → ນອກ).
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

  const indoorSet = realSerial(job.pro_sn);
  const outdoorSet = realSerial(job.pro_sn_out);
  const scanned = norm(value);

  /**
   * ລົງຊ່ອງໃດ:
   *   ① ຊ່າງເລືອກເອງໃນແອັບ (ຄົນທີ່ຢືນຢູ່ໜ້າເຄື່ອງຮູ້ດີກວ່າໃຜ)
   *   ② ຕົງກັບຄ່າທີ່ໃບງານມີຢູ່ແລ້ວ = ຢືນຢັນຊ້ຳຊ່ອງນັ້ນ (ຢ່າໃຫ້ເລກອັນດຽວລົງ 2 ຊ່ອງ)
   *   ③ ບໍ່ມີຫຍັງໃຫ້ອີງ ⇒ ຊ່ອງທີ່ຫວ່າງກ່ອນ (ໃນ → ນອກ), ເຕັມໝົດ ⇒ ທັບໜ່ວຍໃນ
   */
  const part: "indoor" | "outdoor" =
    indoorSet === scanned
      ? "indoor"
      : outdoorSet === scanned
        ? "outdoor"
        : options.part === "indoor" || options.part === "outdoor"
          ? options.part
          : !indoorSet
            ? "indoor"
            : needsOutdoor(job) && !outdoorSet
              ? "outdoor"
              : "indoor";

  const current = part === "indoor" ? indoorSet : outdoorSet;
  const currentRaw = (part === "indoor" ? job.pro_sn : job.pro_sn_out) ?? "";
  const where = part === "indoor" ? "ໜ່ວຍໃນ" : "ໜ່ວຍນອກ";
  const replaced = Boolean(current) && current !== scanned;

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
        value,
        session.username,
      ]);
    }
    await client.query(
      `insert into ods_install_scan(job_code, phase, scanned, matched, tech_code, prev_value, mismatch)
       values($1,$2,$3,$4,$5,$6,$7)`,
      [
        code,
        phase,
        value.slice(0, 60),
        part,
        session.username,
        currentRaw.slice(0, 60) || null,
        // ທັບຂອງເກົ່າ = ແຖວທີ່ຜູ້ຈັດການຄວນເຫັນ (ໃບງານເຄີຍລະບຸອີກເລກໜຶ່ງ)
        replaced,
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
  // ປະຫວັດການອັບເດດ pro_sn / pro_sn_out — ຄ່າເກົ່າ → ຄ່າໃໝ່
  const note = replaced
    ? `⚠️ ແກ້ຈາກ ${currentRaw} ⇒ ${value}`
    : current
      ? "ຢືນຢັນຊ້ຳ — ຄືເກົ່າ"
      : `ບັນທຶກໃສ່ໃບງານ ${value}`;
  await logChange("ods_tb_install", code, `${how} ${where}: ${value} — ${note}`, {
    author: session.username,
  });

  return {
    ok: true,
    matched: part,
    message: replaced
      ? `ແກ້${where} ຈາກ ${currentRaw} ເປັນ ${value}`
      : current
        ? `ຢືນຢັນ${where}ແລ້ວ — ${value}`
        : `ບັນທຶກ${where}ແລ້ວ — ${value}`,
  };
}

/**
 * **ປະຫວັດການອັບເດດ ISN/SN ຂອງໃບງານນີ້** (ໃຫ້ໜ້າໃບງານ ແລະ ແອັບ ສະແດງ) —
 * ແຕ່ລະແຖວ = 1 ຄັ້ງທີ່ຊ່າງເກັບເລກ: ລົງຊ່ອງໃດ · ຄ່າເກົ່າແມ່ນຫຍັງ · ທັບຂອງເກົ່າບໍ.
 */
export async function installScans(code: string) {
  return (
    await query<{
      id: number;
      phase: string;
      scanned: string;
      matched: string;
      tech_code: string | null;
      scanned_at: string;
      prev_value: string | null;
      mismatch: boolean;
    }>(
      `select id, phase, scanned, matched, tech_code,
          prev_value, coalesce(mismatch,false) mismatch,
          to_char(scanned_at,'DD-MM-YYYY HH24:MI') scanned_at
        from ods_install_scan where job_code = $1 order by id`,
      [code],
    )
  ).rows;
}
