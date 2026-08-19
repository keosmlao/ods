import type { Session } from "@/lib/auth";
import { logChange } from "@/lib/chatter-log";
import { query, queryOdg } from "@/lib/db";
import { blockNonStandard, getStandardKitLines, getStandardSpares, type StandardSpare } from "@/lib/install-standard";
import { ownMobileJob, type FlowResult } from "@/lib/job-flow";
import { SETTING, settingEnabled } from "@/lib/settings";
import { TRANS } from "@/lib/stock-constants";

/**
 * ── ກະຕ່າອາໄຫຼ່ຂອງ**ງານຕິດຕັ້ງ** ສຳລັບແອັບຊ່າງ ──
 *
 * ຄູ່ກັບຟອມຝັ່ງເວັບ (/installations/spare-requests/[code] → actions/installation
 * addSpareLine · addSpareLines · deleteSpareLine · updateSpareQty). ຝັ່ງເວັບໃຊ້ cookie
 * session (guardJob); ແອັບໃຊ້ Bearer (ownMobileJob) ⇒ ຕ້ອງມີສະບັບຮັບ `session`
 * — ຮູບແບບດຽວກັບ lib/repair-spare ຂອງສາຍງານສ້ອມ.
 *
 * ⚠️ **ບັກທີ່ແກ້ຢູ່ນີ້**: ແອັບຊ່າງບໍ່ເຄີຍມີທາງເລືອກລາຍການອາໄຫຼ່ຂອງງານຕິດຕັ້ງເລີຍ —
 * ມີແຕ່ໜ້າ "ໃບຂໍເບີກ" ທີ່ເລືອກ ສາງ/ທີ່ເກັບ ແລ້ວຂໍ**ທັງກະຕ່າ**. ກະຕ່າຖືກຕື່ມຕອນເປີດງານ
 * (ຊຸດຕາມ install_type) ເທົ່ານັ້ນ ⇒ ຊ່າງທີ່ຢູ່ໜ້າງານ ຢາກປ່ຽນຂອງແທນກັນ (ຂາເຫລັກ AAA →
 * SVT · ນ໋ອດ 3/8 → 5/16) ຫຼື ງານທີ່ບໍ່ມີຊຸດ (ໂທລະທັດ · ຈັກຊັກ) ຕ້ອງກັບໄປໃຊ້ເວັບ
 * ຫຼື ບອກ CS ໃຫ້ແກ້ໃຫ້. ດຽວນີ້ເພີ່ມ/ຖອດ/ແກ້ຈຳນວນ ໄດ້ຈາກແອັບ ດ້ວຍ**ດ່ານຊຸດດຽວກັບເວັບ**.
 *
 * ── ໜ້າຕ່າງທີ່ແກ້ໄດ້ (ຄືກັບ addSpareLine ຝັ່ງເວັບ) ──
 *   ຮັບງານແລ້ວ (tech_confirm) · ຍັງບໍ່ເລີ່ມຕິດຕັ້ງ (start_install) · ບໍ່ຍົກເລີກ/ບໍ່ປິດ
 * ⇒ ຄອບຂັ້ນ 1-4 (lib/install-stage) ບໍ່ແມ່ນສະເພາະຂັ້ນ 2-3 — ຊ່າງທີ່ຂໍໄປແລ້ວແຕ່ຍັງບໍ່
 * ລົງມື ຍັງເພີ່ມລາຍການທີ່ລືມໄດ້ (ຈະໄປຢູ່ໃບຂໍຮອບຖັດໄປ).
 */

/**
 * ແຖວທີ່ "ເຂົ້າເອກະສານແລ້ວ" — ຖອດ/ແກ້ຈຳນວນບໍ່ໄດ້ (ບໍ່ດັ່ງນັ້ນເອກະສານກັບກະຕ່າຂັດກັນ)
 *
 * ⚠️ ຕ້ອງ query ດ້ວຍ alias `s` ໃສ່ `tb_used_spare`.
 *
 * export ອອກເພື່ອໃຫ້ **ທຸກທາງເຂົ້າໃຊ້ນິຍາມອັນດຽວ**: ແອັບຊ່າງ (ໄຟລ໌ນີ້), ຟອມເວັບ
 * (actions/installation → deleteSpareLine · updateSpareQty) ແລະ **ໜ້າລາຍລະອຽດງານ**
 * (components/installation/job-spares-editor ໃຊ້ຄ່ານີ້ປິດປຸ່ມໃຫ້ຖືກ).
 * ກ່ອນແກ້: ຝັ່ງເວັບກວດແຕ່ `reg_start`/`reg_finish` ⇒ ແຖວທີ່ **ຊ່າງຮັບໄປແລ້ວ**
 * (pick_finish) ຫຼື ທີ່ມີ 122/56 ແຕ່ຖັນກະຕ່າເປັນ null (ພົບຈິງ: INST-5849/5850)
 * ຍັງລົບ/ແກ້ຈຳນວນໄດ້ ⇒ ກະຕ່າກັບເອກະສານແຍກກັນ ແລ້ວ savePickSpare ຫາແຖວຄູ່ບໍ່ພົບ.
 */
export const SPARE_ON_DOC = `(s.reg_start is not null or s.reg_finish is not null or s.pick_finish is not null
  or exists (
    select 1 from ic_trans_detail d
    where d.product_code = s.product_code and d.item_code = s.item_code
      and d.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH})))`;

export type InstallSpareLine = {
  roworder: number;
  item_code: string;
  item_name: string;
  qty: number;
  unit_code: string | null;
  /** ຢູ່ໃບຂໍເບີກແລ້ວ */
  requested: boolean;
  /** ເຂົ້າເອກະສານແລ້ວ ⇒ ຖອດ/ແກ້ຈຳນວນບໍ່ໄດ້ */
  locked: boolean;
  /** ຢູ່ໃນຊຸດຕິດຕັ້ງຂອງໃບງານ (ບໍ່ແມ່ນລາຍການນອກມາດຕະຖານ) */
  standard: boolean;
  /** ວັນທີ່ຂໍເບີກ · ສາງເບີກ · ຊ່າງຮັບ (DD-MM-YYYY) — ໃຫ້ໜ້າເວັບສະແດງຄືເກົ່າ */
  reg_start: string | null;
  reg_finish: string | null;
  pick_finish: string | null;
};

/** ລາຍການໃນກະຕ່າ + ທຸງບອກວ່າແຖວໃດຍັງແກ້ໄດ້ (ໃຫ້ແອັບປິດປຸ່ມໃຫ້ຖືກ) */
export async function listInstallSpares(code: string): Promise<InstallSpareLine[]> {
  const [rows, kit] = await Promise.all([
    query<Omit<InstallSpareLine, "standard">>(
      `select s.roworder, s.item_code, coalesce(s.item_name,'') item_name,
          coalesce(s.qty,0)::float8 qty, s.unit_code,
          (s.reg_start is not null or exists (
             select 1 from ic_trans_detail d
             where d.product_code = s.product_code and d.item_code = s.item_code
               and d.trans_flag = ${TRANS.REQUEST})) as "requested",
          ${SPARE_ON_DOC} as "locked",
          to_char(s.reg_start,'DD-MM-YYYY') as reg_start,
          to_char(s.reg_finish,'DD-MM-YYYY') as reg_finish,
          to_char(s.pick_finish,'DD-MM-YYYY') as pick_finish
        from tb_used_spare s where s.product_code = $1 order by s.roworder`,
      [code],
    ),
    getStandardKitLines(code),
  ]);
  return rows.rows.map((row) => ({ ...row, standard: kit.has(row.item_code) }));
}

/** ຊຸດຕິດຕັ້ງຂອງໃບງານ + ເປີດໃຫ້ຄົ້ນນອກຊຸດບໍ (ໃຫ້ແອັບເຊື່ອງຊ່ອງຄົ້ນຫາຕາມ) */
export async function installSpareStandards(
  code: string,
): Promise<{ items: StandardSpare[]; free_search: boolean }> {
  const [items, freeSearch] = await Promise.all([
    getStandardSpares(code),
    settingEnabled(SETTING.INSTALL_SPARE_FREE_SEARCH),
  ]);
  return { items, free_search: freeSearch };
}

/** ດ່ານຮ່ວມ: ງານຂອງຕົນ · ຮັບແລ້ວ · ຍັງບໍ່ເລີ່ມຕິດຕັ້ງ (ຊຸດດຽວກັບ guardJob ຝັ່ງເວັບ) */
async function editableJob(session: Session, code: string): Promise<FlowResult> {
  const own = await ownMobileJob(session, "install", code);
  if (!own.ok) return own;

  const job = (
    await query<{ accepted: boolean; started: boolean; closed: boolean }>(
      `select tech_confirm is not null accepted, start_install is not null started,
              job_finish is not null closed
         from ods_tb_install where code=$1`,
      [code],
    )
  ).rows[0];
  if (!job) return { ok: false, error: "ບໍ່ພົບງານຕິດຕັ້ງນີ້" };
  if (job.closed) return { ok: false, error: "ງານນີ້ປິດແລ້ວ" };
  if (!job.accepted) return { ok: false, error: "ຕ້ອງຮັບງານກ່ອນເພີ່ມອາໄຫຼ່" };
  if (job.started) return { ok: false, error: "ແກ້ອາໄຫຼ່ບໍ່ໄດ້ — ເລີ່ມຕິດຕັ້ງແລ້ວ" };
  return { ok: true, message: "" };
}

/**
 * ເພີ່ມ 1 ລາຍການເຂົ້າກະຕ່າ.
 *
 * ຈຳນວນ **ແລະ ຫົວໜ່ວຍ** ຕັ້ງຕົ້ນເອົາຈາກ**ຊຸດຕິດຕັ້ງ** (ບໍ່ເຊື່ອຄ່າຈາກແອັບ) ຄືກັບ
 * addSpareLines ຝັ່ງເວັບ — ນອກຊຸດ = 1 ພ້ອມຫົວໜ່ວຍມາດຕະຖານຂອງສິນຄ້າ. ຢູ່ໃນກະຕ່າແລ້ວ
 * ບໍ່ insert ຊ້ຳ (ໃຫ້ໃຊ້ປຸ່ມ +/− ແທນ ⇒ ບໍ່ມີແຖວຊ້ຳຄືຂໍ້ມູນເກົ່າ).
 */
export async function addInstallSpare(
  session: Session,
  code: string,
  itemCode: string,
): Promise<FlowResult> {
  const gate = await editableJob(session, code);
  if (!gate.ok) return gate;

  const item = String(itemCode ?? "").trim();
  if (!item) return { ok: false, error: "ບໍ່ພົບລະຫັດອາໄຫຼ່" };

  const blocked = await blockNonStandard(code, [item]);
  if (blocked) return { ok: false, error: blocked };

  let canonical: { code: string; name_1: string; unit_code: string | null } | undefined;
  try {
    canonical = (
      await queryOdg<{ code: string; name_1: string; unit_code: string | null }>(
        "select code, name_1, unit_standard as unit_code from ic_inventory where code=$1 limit 1",
        [item],
      )
    ).rows[0];
  } catch (error) {
    console.error("addInstallSpare ERP lookup failed", error);
    return { ok: false, error: "ຄົ້ນຫາລາຍການໃນ ERP ບໍ່ສຳເລັດ" };
  }
  if (!canonical) return { ok: false, error: "ບໍ່ພົບອາໄຫຼ່ໃນລາຍການສິນຄ້າ" };

  const standard = (await getStandardKitLines(code)).get(canonical.code);
  const inserted = await query(
    `insert into tb_used_spare(product_code,item_code,item_name,qty,unit_code)
     select $1::varchar,$2::varchar,$3::varchar,$5::numeric,$4::varchar
     where not exists (
       select 1 from tb_used_spare where product_code=$1::varchar and item_code=$2::varchar
     )`,
    [
      code,
      canonical.code,
      canonical.name_1,
      standard?.unit_code ?? canonical.unit_code ?? "",
      Math.max(1, Math.round((standard?.qty ?? 1) * 100) / 100),
    ],
  );
  if (!inserted.rowCount) return { ok: false, error: "ລາຍການນີ້ຢູ່ໃນລາຍການແລ້ວ" };

  /**
   * ເພີ່ມມາດຕະຖານໃໝ່ = ຍອດ "ຮັບຄົບແລ້ວ" ເກົ່າໃຊ້ບໍ່ໄດ້ອີກ ⇒ ລ້າງ pick_finish
   * ດຶງງານກັບຈາກ "ລໍຕິດຕັ້ງ" ມາຂໍ/ຮັບໃຫ້ຄົບ (ຄືກັບ addSpareLine ຝັ່ງເວັບ).
   */
  await query("update ods_tb_install set used_spare=1, pick_finish=null where code=$1", [code]);
  await query("update ods_tb_install_detail set pick_finish=null where code=$1", [code]);
  await logChange("ods_tb_install", code, `ເພີ່ມອາໄຫຼ່: ${canonical.name_1}`, {
    author: session.username,
  });
  return { ok: true, message: "ເພີ່ມແລ້ວ" };
}

/** ຖອດແຖວອອກຈາກກະຕ່າ — ແຖວທີ່ເຂົ້າເອກະສານແລ້ວຖອດບໍ່ໄດ້ */
export async function removeInstallSpare(
  session: Session,
  code: string,
  roworder: number,
): Promise<FlowResult> {
  const gate = await editableJob(session, code);
  if (!gate.ok) return gate;
  if (!Number.isFinite(roworder)) return { ok: false, error: "ບໍ່ພົບລາຍການ" };

  const removed = await query<{ item_name: string | null }>(
    `delete from tb_used_spare s where s.roworder=$1 and s.product_code=$2 and not ${SPARE_ON_DOC}
     returning s.item_name`,
    [roworder, code],
  );
  if (!removed.rowCount) {
    return { ok: false, error: "ຖອດບໍ່ໄດ້ — ອາໄຫຼ່ແຖວນີ້ຖືກຂໍເບີກ/ເບີກອອກໄປແລ້ວ" };
  }

  // ກະຕ່າຫວ່າງ ແລະ ບໍ່ມີເອກະສານເບີກຈັກໃບ ⇒ ປັດທຸງລົງ (ຄວາມຈິງ = ບໍ່ໃຊ້ອາໄຫຼ່)
  await query(
    `update ods_tb_install set used_spare=0
      where code=$1
        and not exists (select 1 from tb_used_spare s where s.product_code=$1)
        and not exists (select 1 from ic_trans t where t.product_code=$1
                         and t.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}))`,
    [code],
  );
  await logChange("ods_tb_install", code, `ຖອດອາໄຫຼ່: ${removed.rows[0]?.item_name ?? ""}`, {
    author: session.username,
  });
  return { ok: true, message: "ຖອດອອກແລ້ວ" };
}

/** ແກ້ຈຳນວນ (update_qty_reg_spare ຝັ່ງເວັບ) — ສະເພາະແຖວທີ່ຍັງບໍ່ເຂົ້າເອກະສານ */
export async function setInstallSpareQty(
  session: Session,
  code: string,
  roworder: number,
  qty: number,
): Promise<FlowResult> {
  const gate = await editableJob(session, code);
  if (!gate.ok) return gate;
  if (!Number.isFinite(qty) || qty <= 0 || qty > 9999) return { ok: false, error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };

  const done = await query(
    `update tb_used_spare s set qty=round($1::numeric,2)
      where s.roworder=$2 and s.product_code=$3 and not ${SPARE_ON_DOC}`,
    [qty, roworder, code],
  );
  if (!done.rowCount) return { ok: false, error: "ແກ້ບໍ່ໄດ້ — ອາໄຫຼ່ແຖວນີ້ຖືກຂໍເບີກ/ເບີກອອກໄປແລ້ວ" };
  return { ok: true, message: "ບັນທຶກແລ້ວ" };
}
