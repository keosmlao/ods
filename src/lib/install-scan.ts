import { query, queryOdg } from "@/lib/db";
import { logChange } from "@/lib/chatter-log";
import type { Session } from "@/lib/auth";

/**
 * **ສະແກນ ISN/SN ຂອງງານຕິດຕັ້ງ — ພິສູດວ່າຕິດຖືກໜ່ວຍ** (07-08-2026).
 *
 * ── ບັນຫາທີ່ແກ້ ──
 * ໃບງານຮູ້ຢູ່ແລ້ວວ່າຄວນຕິດເຄື່ອງເລກໃດ (`pro_sn` ໜ່ວຍໃນ · `pro_sn_out` ໜ່ວຍນອກ —
 * ມາຈາກ ISN ທີ່ຂາຍໃນບິນ) ແຕ່ບໍ່ເຄີຍມີການພິສູດວ່າ**ໜ່ວຍທີ່ຕິດຈິງ**ແມ່ນອັນນັ້ນ.
 * ຊ່າງສະແກນປ້າຍດ້ວຍກ້ອງ ⇒ ທຽບໃຫ້ທັນທີ ບໍ່ຕ້ອງພິມ ແລະ ບໍ່ຕ້ອງເຊື່ອຄວາມຈຳ.
 *
 * ── ຮັບຄ່າໄດ້ 2 ທາງ (07-08-2026) ──
 * **ຍິງກ້ອງ** (ທາງຫຼັກ) ຫຼື **ພິມເອງ** — ບັງຄັບຍິງຢ່າງດຽວບໍ່ໄດ້ ເພາະປ້າຍຈືດ · ຕິດຢູ່ບ່ອນ
 * ຈໍ້ກ້ອງບໍ່ເຖິງ · ບາໂຄດຂາດ ⇒ ຊ່າງຄາຢູ່ໜ້າງານ ປິດງານບໍ່ໄດ້. ພິມເອງກໍ່**ຍັງຖືກທຽບ**
 * ຄືເກົ່າ (ຫຼອກລະບົບບໍ່ໄດ້) ພຽງແຕ່ໝາຍໄວ້ໃນປະຫວັດວ່າ "ປ້ອນເລກເອງ" ໃຫ້ກວດຍ້ອນຫຼັງໄດ້.
 *
 * ── ຮັບເລກໄດ້ 2 ແບບ ──
 * ① **ISN** (ປ້າຍ ODIEN) ② **SN ໂຮງງານ** (ປ້າຍຜູ້ຜະລິດ) — ແປງຫາກັນຜ່ານ ERP
 * `sn_inventory` (isn ↔ sn). ຂໍ້ມູນຈິງ: `pro_sn` ຂອງໃບງານເກັບເປັນ **SN ໂຮງງານ**
 * ⇒ ຊ່າງຍິງ ISN ກໍ່ຕົງໄດ້ ຫຼັງແປງແລ້ວ.
 *
 * ── ຫຼັກການທຽບ ──
 * ຕັດຊ່ອງຫວ່າງ + ບໍ່ສົນຕົວພິມ (ປ້າຍບາງອັນມີຂີດ/ຍະຫວ່າງ). ບໍ່ຕົງ ⇒ ປະຕິເສດພ້ອມບອກ
 * ວ່າໃບງານລໍໜ່ວຍໃດ — ຢ່າໃຫ້ຜ່ານໄປແລ້ວມາຮູ້ພາຍຫຼັງ.
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

/**
 * ແປງຄ່າທີ່ສະແກນມາເປັນຄູ່ (isn, sn) ຈາກ ERP.
 * ຫາບໍ່ພົບ ⇒ ຄືນຄ່າດິບເປັນ sn ໄວ້ (ເຄື່ອງທີ່ບໍ່ໄດ້ຜ່ານລະບົບ ISN ຍັງທຽບກັບໃບງານໄດ້).
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
    // ERP ລົ້ມ ⇒ ຍັງທຽບກັບໃບງານໄດ້ດ້ວຍຄ່າດິບ (ຢ່າໃຫ້ຊ່າງຕິດຢູ່ໜ້າງານ)
    console.error("resolveSerial failed", value, error);
    return { isn: null, sn: value };
  }
}

/**
 * ທຽບ + ບັນທຶກການສະແກນ. ບໍ່ຕົງ ⇒ **ບໍ່ບັນທຶກ** (ບໍ່ໃຫ້ມີແຖວທີ່ຜ່ານແບບຜິດໆ).
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

  const job = (
    await query<{ pro_sn: string | null; pro_sn_out: string | null }>(
      `select nullif(pro_sn,'') pro_sn, nullif(pro_sn_out,'') pro_sn_out
         from ods_tb_install where code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) return { ok: false, error: "ບໍ່ພົບໃບງານນີ້" };
  if (!realSerial(job.pro_sn) && !realSerial(job.pro_sn_out)) {
    return { ok: false, error: "ໃບງານນີ້ບໍ່ໄດ້ລະບຸ ISN/SN ໄວ້ — ໃຫ້ CS ໃສ່ໃນໃບງານກ່ອນ" };
  }

  const { isn, sn } = await resolveSerial(value);
  const candidates = [norm(value), norm(isn), norm(sn)].filter(Boolean);
  const indoor = realSerial(job.pro_sn);
  const outdoor = realSerial(job.pro_sn_out);
  const matched: "indoor" | "outdoor" | null =
    indoor && candidates.includes(indoor) ? "indoor" : outdoor && candidates.includes(outdoor) ? "outdoor" : null;

  if (!matched) {
    return {
      ok: false,
      error:
        `ບໍ່ຕົງກັບໃບງານ — ໃບນີ້ຕ້ອງເປັນ ${job.pro_sn ?? "-"}` +
        `${job.pro_sn_out ? ` (ໜ່ວຍນອກ ${job.pro_sn_out})` : ""} ແຕ່ສະແກນໄດ້ ${value}`,
    };
  }

  await query(
    `insert into ods_install_scan(job_code, phase, scanned, matched, isn, sn, tech_code)
     values($1,$2,$3,$4,$5,$6,$7)`,
    [code, phase, value.slice(0, 60), matched, isn, sn, session.username],
  );

  const where = matched === "indoor" ? "ໜ່ວຍໃນ" : "ໜ່ວຍນອກ";
  // ຍິງກ້ອງ ຫຼື ພິມເອງ — ຫຼັກຖານໜັກບໍ່ເທົ່າກັນ ⇒ ຂຽນຄົນລະຄຳໃນປະຫວັດ
  const how = options.manual ? "ປ້ອນເລກເອງ" : "ສະແກນ";
  await logChange(
    "ods_tb_install",
    code,
    `${how} ${phase === "finish" ? "ກ່ອນຈົບງານ" : "ຕອນຕິດຕັ້ງ"}: ${where} ${sn ?? value}${isn ? ` (ISN ${isn})` : ""} — ຕົງກັບໃບງານ`,
    { author: session.username },
  );

  return { ok: true, matched, isn, sn, message: `ຕົງກັບໃບງານ — ${where} ${sn ?? value}` };
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

/** ສະແກນຄົບຂັ້ນ 'ຕອນຕິດຕັ້ງ' ແລ້ວບໍ — ດ່ານກ່ອນຈົບງານ */
export async function hasInstallScan(code: string, phase: ScanPhase): Promise<boolean> {
  const row = (
    await query<{ n: number }>(
      "select count(*)::int n from ods_install_scan where job_code=$1 and phase=$2",
      [code, phase],
    )
  ).rows[0];
  return (row?.n ?? 0) > 0;
}
