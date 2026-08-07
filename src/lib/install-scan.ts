import { query, queryOdg } from "@/lib/db";
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
 * ── ຢືນຢັນວ່າແມ່ນໜ່ວຍຂອງລູກຄ້າຈິງ ──
 * ເລກທີ່ໄດ້ຕ້ອງຢູ່ໃນ**ໃບຈ່າຍສິນຄ້າຂອງບິນນັ້ນ** — ບໍ່ຢູ່ ⇒ ປະຕິເສດ (ຕິດຜິດໜ່ວຍ =
 * ຮັບປະກັນຜິດຄົນ). ບິນທີ່ ERP ບໍ່ໄດ້ລົງ ISN ໄວ້ຈັກແຖວ ⇒ ບໍ່ມີຫຍັງໃຫ້ທຽບ ⇒ ຮັບໄວ້
 * ພ້ອມໝາຍໃນປະຫວັດວ່າ “ບິນບໍ່ໄດ້ລົງ ISN” (ຢ່າໃຫ້ຊ່າງຄາຢູ່ໜ້າງານ).
 *
 * ── ຮັບເລກໄດ້ 2 ແບບ · ໄດ້ 2 ທາງ ──
 * ① ISN (ປ້າຍ ODIEN) ② SN ໂຮງງານ — ແປງຫາກັນຜ່ານ `sn_inventory`.
 * ຍິງກ້ອງ (ທາງຫຼັກ) ຫຼື ພິມເອງ — ພິມເອງກໍ່ຖືກທຽບຄືກັນ ພຽງແຕ່ໝາຍໄວ້ໃນປະຫວັດ.
 */

export type ScanPhase = "install" | "finish";

export type ScanResult =
  | { ok: true; matched: "indoor" | "outdoor"; isn: string | null; sn: string | null; message: string }
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
 * ເກັບ / ຢືນຢັນ ISN-SN ຂອງໜ່ວຍທີ່ຕິດຈິງ.
 *
 * ຊ່ອງຫວ່າງ ⇒ **ບັນທຶກໃສ່ໃບງານ** · ຊ່ອງມີເລກຢູ່ແລ້ວ ⇒ **ທຽບ** (ບໍ່ຕົງ ⇒ ປະຕິເສດ,
 * ບໍ່ທັບຂອງເກົ່າ — ຂອງເກົ່າອາດຖືກ ແລະ ຊ່າງອາດຍິງຜິດໜ່ວຍ).
 */
export async function recordInstallScan(
  session: Session,
  code: string,
  raw: string,
  phase: ScanPhase,
  options: { manual?: boolean } = {},
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

  // ── ໜ່ວຍນີ້ແມ່ນຂອງບິນນີ້ບໍ ແລະ ເປັນໜ່ວຍໃນ ຫຼື ໜ່ວຍນອກ ──
  const hit = units.find(
    (unit) => candidates.includes(norm(unit.isn)) || candidates.includes(norm(unit.sn)),
  );

  let part: "indoor" | "outdoor";
  if (hit) {
    part = hit.part;
  } else if (units.length) {
    // ບິນລົງ ISN ໄວ້ ແຕ່ເລກນີ້ບໍ່ຢູ່ໃນນັ້ນ = ຄົນລະໜ່ວຍກັບທີ່ລູກຄ້າຊື້
    return {
      ok: false,
      error:
        `ເລກນີ້ບໍ່ແມ່ນໜ່ວຍທີ່ຈ່າຍໃຫ້ບິນ ${job.doc_ref_1} — ບິນນີ້ຈ່າຍ ` +
        units.map((unit) => `${unit.isn}${unit.part === "outdoor" ? " (ໜ່ວຍນອກ)" : ""}`).join(" · "),
    };
  } else if (indoorSet && candidates.includes(indoorSet)) {
    part = "indoor";
  } else if (outdoorSet && candidates.includes(outdoorSet)) {
    part = "outdoor";
  } else if (indoorSet || outdoorSet) {
    // ໃບງານມີເລກໄວ້ແລ້ວ (CS ໃສ່ເອງ) ແຕ່ໄດ້ມາບໍ່ຕົງ
    return {
      ok: false,
      error:
        `ບໍ່ຕົງກັບໃບງານ — ໃບນີ້ລະບຸ ${job.pro_sn ?? "-"}` +
        `${job.pro_sn_out ? ` (ໜ່ວຍນອກ ${job.pro_sn_out})` : ""} ແຕ່ໄດ້ ${value}`,
    };
  } else {
    /**
     * ບິນບໍ່ໄດ້ລົງ ISN ແລະ ໃບງານກໍ່ຫວ່າງ ⇒ ບໍ່ມີຫຍັງໃຫ້ທຽບ. ຮັບໄວ້ກ່ອນ (ຢ່າໃຫ້ຊ່າງຄາຢູ່
     * ໜ້າງານ) ໂດຍໃສ່**ຊ່ອງໜ່ວຍໃນກ່ອນ** ແລ້ວອັນທີສອງຈຶ່ງເປັນໜ່ວຍນອກ (ແອ).
     */
    part = indoorSet ? "outdoor" : "indoor";
  }

  const current = part === "indoor" ? indoorSet : outdoorSet;
  const where = part === "indoor" ? "ໜ່ວຍໃນ" : "ໜ່ວຍນອກ";
  const label = sn && sn !== value ? `${sn}${isn ? ` (ISN ${isn})` : ""}` : value;

  /**
   * ── ໃບຈ່າຍສິນຄ້າ**ຊະນະ**ຄ່າທີ່ພິມໄວ້ (07-08-2026) ──
   * ເລກທີ່ຢືນຢັນແລ້ວວ່າຢູ່ໃນໃບຈ່າຍຂອງບິນ = ຄວາມຈິງ ⇒ ຖ້າຊ່ອງເກົ່າບໍ່ຕົງ ໃຫ້**ທັບ**
   * ພ້ອມບັນທຶກໄວ້ໃນປະຫວັດ. ບໍ່ດັ່ງນັ້ນໃບທີ່ CS ພິມຜິດ (ວັດຈິງ INST-7213 ກັບ 7214
   * ໄດ້ເລກອັນດຽວກັນ) ຈະບລັອກຊ່າງຢູ່ໜ້າງານ ແລະ ແກ້ເອງບໍ່ໄດ້.
   * ຄ່າທີ່**ບໍ່ໄດ້ຢືນຢັນ**ຈາກບິນ ⇒ ຄືເກົ່າ: ບໍ່ຕົງ = ປະຕິເສດ (ຢ່າໃຫ້ທັບຂອງດີດ້ວຍຂອງມົ້ວ).
   */
  const replaced = Boolean(current) && !candidates.includes(current);
  if (replaced && !hit) {
    return { ok: false, error: `ຊ່ອງ${where}ຂອງໃບງານເປັນ ${current} ແລ້ວ — ເລກທີ່ໄດ້ ${value} ບໍ່ຕົງ` };
  }
  if (!current || replaced) {
    const column = part === "indoor" ? "pro_sn" : "pro_sn_out";
    await query(`update ods_tb_install set ${column}=$2, user_edit=$3 where code=$1`, [
      code,
      sn ?? value,
      session.username,
    ]);
  }

  await query(
    `insert into ods_install_scan(job_code, phase, scanned, matched, isn, sn, tech_code)
     values($1,$2,$3,$4,$5,$6,$7)`,
    [code, phase, value.slice(0, 60), part, isn, sn, session.username],
  );

  // ຍິງກ້ອງ ຫຼື ພິມເອງ — ຫຼັກຖານໜັກບໍ່ເທົ່າກັນ ⇒ ຂຽນຄົນລະຄຳໃນປະຫວັດ
  const how = options.manual ? "ປ້ອນເລກເອງ" : "ສະແກນ";
  const note = replaced
    ? `⚠️ ແກ້ຈາກ ${current} ເປັນເລກນີ້ — ໃບຈ່າຍສິນຄ້າຂອງບິນລະບຸແນວນີ້`
    : current
      ? "ຢືນຢັນຊ້ຳ — ຕົງກັບໃບງານ"
      : units.length
        ? "ບັນທຶກໃສ່ໃບງານ — ຕົງກັບໜ່ວຍທີ່ຈ່າຍໃນບິນ"
        : "ບັນທຶກໃສ່ໃບງານ — ⚠️ ບິນບໍ່ໄດ້ລົງ ISN ໄວ້ ຈຶ່ງທຽບບໍ່ໄດ້";
  await logChange("ods_tb_install", code, `${how} ${where}: ${label} — ${note}`, {
    author: session.username,
  });

  return {
    ok: true,
    matched: part,
    isn,
    sn,
    message: replaced
      ? `ແກ້${where}ໃຫ້ຖືກຕາມບິນແລ້ວ — ${label}`
      : current
        ? `ຢືນຢັນ${where}ແລ້ວ — ${label}`
        : `ບັນທຶກ${where}ແລ້ວ — ${label}`,
  };
}

/** ສະແກນຂອງໃບງານນີ້ (ໃຫ້ໜ້າໃບງານ ແລະ ແອັບ ສະແດງ) */
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
    }>(
      `select id, phase, scanned, matched, isn, sn, tech_code,
          to_char(scanned_at,'DD-MM-YYYY HH24:MI') scanned_at
        from ods_install_scan where job_code = $1 order by id`,
      [code],
    )
  ).rows;
}
