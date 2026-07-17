import { logChange } from "@/lib/chatter-log";
import type { Session } from "@/lib/auth";
import { ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, odgDb, query, queryOdg } from "@/lib/db";
import { writeErpRequest } from "@/lib/erp-request";
import { nextDocNo } from "@/lib/doc-no";
import type { FlowResult } from "@/lib/job-flow";
import { roleOf } from "@/lib/roles";
import { canViewAssignedJob } from "@/lib/scope";
import { STAGE_SQL } from "@/lib/stage";
import { ERP, LINE_STATUS, RETURN_SHELF, RETURN_WH, TRANS } from "@/lib/stock-constants";

/**
 * ຂັ້ນຕອນຂອງຊ່າງ ພາກ **ກວດເຊັກ ແລະ ອາໄຫຼ່** — ໃຊ້ຮ່ວມກັນລະຫວ່າງເວັບ ແລະ ແອັບມືຖື
 * (ຄູ່ກັບ lib/job-flow ທີ່ຄຸມ ຮັບງານ/ເລີ່ມ/ຈົບ/check-in).
 *
 * ເງື່ອນໄຂຂັ້ນຢູ່ໃນ WHERE ຂອງແຕ່ລະຄຳສັ່ງ (ບໍ່ແມ່ນກວດກ່ອນແລ້ວຄ່ອຍຂຽນ) ⇒ ຍິງໃສ່ວຽກທີ່
 * ບໍ່ໄດ້ຢູ່ຂັ້ນນັ້ນ = ບໍ່ມີຫຍັງເກີດຂຶ້ນ ແລະ ສອງເຄື່ອງກົດພ້ອມກັນກໍ່ບໍ່ຊ້ຳ.
 */

const NOW = "localtimestamp(0)";
/** ລັອກຕອນອອກເລກເອກະສານ — ຄ່າດຽວກັບ actions/stock.ts (ຢ່າປ່ຽນ) */
const DOC_LOCK = 734211;
/** ໃບຮັບອາໄຫຼ່ຂອງຊ່າງ (PISP) */
const TRANS_PICK = 166;

const jobModel = (code: string) => (code.startsWith("INST-") ? "ods_tb_install" : "tb_product");

/** ວັນທີ/ເວລາເຂດເວລາລາວ — ຄັດລອກຈາກ actions/stock.ts (ເລກເອກະສານຕ້ອງອີງປີ/ເດືອນອັນດຽວກັນ) */
function nowParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  // ໂມງ:ນາທີ ຕາມເຂດເວລາລາວ — ERP ຕ້ອງການ doc_time (HH:MM)
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    at: new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`),
    time,
  };
}

/**
 * ອາໄຫຼ່ທີ່ **ຍັງບໍ່ທັນຂໍເບີກ/ເບີກອອກ** — ຄັດລອກຈາກ actions/stock.ts (OUTSTANDING_SPARES).
 * ຢ່າຂໍທັງກະຕ່າ: ໃບທີສອງຈະຂໍອາໄຫຼ່ຊຸດເກົ່າຄືນອີກ ແລ້ວສາງເບີກ (ຕັດສະຕັອກ ERP) ສອງເທື່ອ.
 */
const OUTSTANDING_SPARES = `
  select n.item_code, n.item_name, n.unit_code, (n.qty - coalesce(c.qty, 0))::numeric qty
  from (
    select item_code, min(roworder) rn, max(item_name) item_name, max(unit_code) unit_code, sum(qty) qty
    from tb_used_spare where product_code = $1 group by item_code
  ) n
  left join (
    select item_code,
      sum(case when trans_flag = ${TRANS.REQUEST} then qty else -qty end) qty
    from ic_trans_detail
    where product_code = $1 and trans_flag in (${TRANS.REQUEST}, ${TRANS.RETURN_REQUEST})
    group by item_code
  ) c on c.item_code = n.item_code
  where n.qty - coalesce(c.qty, 0) > 0
  order by n.rn`;

/* ── ຄົ້ນຫາອາໄຫຼ່ ────────────────────────────────────────────────── */

export type SpareItem = {
  code: string;
  name_1: string;
  brand: string | null;
  unit_code: string | null;
  balance_qty: number;
};

/** ຄົ້ນຫາອາໄຫຼ່ຈາກ ic_inventory — ບໍ່ພິມຫຍັງກໍ່ຄືນລາຍການທີ່ມີຄົງເຫຼືອຫຼາຍສຸດ */
/**
 * ຄົ້ນຫາອາໄຫຼ່ (ຕອນກວດເຊັກ/ເພີ່ມອາໄຫຼ່) — **ດຶງຈາກ ERP ໂດຍກົງ** (16-07-2026).
 *
 * ແຕ່ກ່ອນອ່ານ `ic_inventory` ຂອງ ODS ເຊິ່ງເປັນ**ເງົາ**ທີ່ອັບເດດສະເພາະຕອນ sync
 * ⇒ ຍອດຄ້າງເກົ່າ: ຊ່າງເຫັນວ່າ "ມີ" ຕອນເລືອກ ແຕ່ພໍຂໍເບີກ ERP ບອກວ່າບໍ່ມີ (ຫຼື ກົງກັນຂ້າມ)
 * — ສາມຈຸດວັດ stock ຄົນລະບ່ອນ ຄືຕົ້ນເຫດຂອງ "ຕອນຂໍເບີກບອກວ່າບໍ່ມີ ຕອນຂໍຊື້ບອກວ່າມີ".
 * ດຽວນີ້ທຸກຈຸດຖາມ ERP ບ່ອນດຽວ.
 */
export async function searchSpares(text: string, inStockOnly = false): Promise<SpareItem[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (text.trim()) {
    params.push(`%${text.trim()}%`);
    where.push("(code ilike $1 or name_1 ilike $1 or item_brand ilike $1)");
  }
  if (inStockOnly) where.push("coalesce(balance_qty,0) > 0");

  try {
    return (
      await queryOdg<SpareItem>(
        `select code, name_1, item_brand as brand, unit_standard as unit_code,
            coalesce(balance_qty,0)::int as balance_qty
           from ic_inventory
          ${where.length ? `where ${where.join(" and ")}` : ""}
          order by coalesce(balance_qty,0) desc, code
          limit 50`,
        params,
      )
    ).rows;
  } catch (error) {
    // ERP ລົ້ມ ⇒ ຄົ້ນຫາຫວ່າງ ດີກວ່າສະແດງຍອດເງົາທີ່ຜິດ
    console.error("searchSpares (ERP) failed", error);
    return [];
  }
}

/* ── ກວດເຊັກ ────────────────────────────────────────────────────── */

export async function startCheckFlow(session: Session, code: string): Promise<FlowResult> {
  // ຊ່າງ: ຕ້ອງເປັນວຽກຂອງຕົນ + ຮັບງານກ່ອນ; ວຽກ **ນອກສະຖານທີ່** (IH/PS) ຕ້ອງ check-in ໜ້າງານ,
  // ວຽກ **ນຳເຄື່ອງເຂົ້າ** (in-shop) ບໍ່ຕ້ອງ check-in. ຜູ້ຈັດການ/CS (ໜ້າ dashboard) ຂ້າມເງື່ອນໄຂນີ້ໄດ້.
  if (roleOf(session) === "technical") {
    const check = await query<{ accepted: boolean; onsite: boolean; checkedin: boolean }>(
      `select a.repair_confirm is not null as accepted,
              coalesce(a.service_type,'') in ('IH','PS') as onsite,
              exists (select 1 from ods_job_checkin c
                       where c.workflow='repair' and c.job_code=a.code and c.tech_code=$2) as checkedin
         from tb_product a where a.code=$1 and a.emp_code=$2`,
      [code, session.username],
    );
    const row = check.rows[0];
    if (!row) return { ok: false, error: "ງານນີ້ບໍ່ແມ່ນຂອງທ່ານ" };
    if (!row.accepted) return { ok: false, error: "ຕ້ອງຮັບງານກ່ອນເລີ່ມກວດເຊັກ" };
    if (row.onsite && !row.checkedin) {
      return { ok: false, error: "ຕ້ອງ check-in ໜ້າງານກ່ອນເລີ່ມກວດເຊັກ (ວຽກນອກສະຖານທີ່)" };
    }
  }

  // ຂັ້ນ 1 = ລໍຖ້າກວດເຊັກ ເທົ່ານັ້ນ (ກົດຊ້ຳບໍ່ຂຽນທັບ ⇒ ໂມງ SLA ບໍ່ຖືກຣີເຊັດ).
  // ຜູ້ຈັດການເລີ່ມກວດເຊັກເອງ (ວຽກຍັງບໍ່ຮັບ) ⇒ ຖືວ່າຮັບງານໃຫ້ນຳ (repair_confirm) ບໍ່ໃຫ້ຄ້າງ.
  const done = await query(
    `update tb_product a set time_check=${NOW}, status=1, repair_confirm=coalesce(a.repair_confirm, ${NOW})
      where a.code=$1 and (${STAGE_SQL}) = 1`,
    [code],
  );
  if (!done.rowCount) return { ok: false, error: 'ເລີ່ມກວດເຊັກບໍ່ໄດ້ — ໃບນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນ "ລໍຖ້າກວດເຊັກ"' };

  await logChange("tb_product", code, "ເລີ່ມກວດເຊັກ");
  return { ok: true, message: `ເລີ່ມກວດເຊັກ ${code}` };
}

/** ກະຕ່າອາໄຫຼ່ຕອນກວດເຊັກ (ic_trans_detail_draft) — ຂອງໃຜຂອງມັນ (user_created) */
export type DraftLine = { roworder: number; item_code: string; item_name: string | null; qty: number; unit_code: string | null };

export async function draftSpares(session: Session, code: string): Promise<DraftLine[]> {
  return (
    await query<DraftLine>(
      `select roworder, item_code, item_name, qty::float as qty, unit_code
         from ic_trans_detail_draft
        where user_created=$1 and product_code=$2 order by roworder`,
      [session.username, code],
    )
  ).rows;
}

export async function addDraftSpare(
  session: Session,
  code: string,
  item: { code: string; name_1: string; unit_code: string | null },
  qty: number,
): Promise<FlowResult> {
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" };

  const product = (
    await query<{ cust_code: string | null }>("select cust_code from tb_product where code=$1 limit 1", [code])
  ).rows[0];
  if (!product) return { ok: false, error: "ບໍ່ພົບໃບຮັບເຄື່ອງ" };

  // ຕົວດຽວກັນເພີ່ມຊ້ຳ → ບວກເຂົ້າແຖວເກົ່າ (ບໍ່ສ້າງແຖວຊ້ຳ)
  const existing = await query(
    `update ic_trans_detail_draft set qty = coalesce(qty,0) + $1
      where user_created=$2 and product_code=$3 and item_code=$4`,
    [qty, session.username, code, item.code],
  );
  if (!existing.rowCount) {
    await query(
      `insert into ic_trans_detail_draft(trans_flag, cust_code, product_code, item_code, item_name, qty, unit_code, user_created)
       values(12, $1, $2, $3, $4, $5, $6, $7)`,
      [product.cust_code, code, item.code, item.name_1, qty, item.unit_code, session.username],
    );
  }
  await logChange("tb_product", code, `ເພີ່ມອາໄຫຼ່ທີ່ຄາດວ່າຈະໃຊ້: ${item.name_1} × ${qty}`);
  return { ok: true, message: "ເພີ່ມແລ້ວ" };
}

export async function removeDraftSpare(session: Session, code: string, roworder: number): Promise<FlowResult> {
  const removed = await query<{ item_name: string | null }>(
    `delete from ic_trans_detail_draft where roworder=$1 and user_created=$2 and product_code=$3 returning item_name`,
    [roworder, session.username, code],
  );
  if (!removed.rowCount) return { ok: false, error: "ບໍ່ພົບລາຍການ" };
  if (removed.rows[0]?.item_name) {
    await logChange("tb_product", code, `ຖອດອາໄຫຼ່ອອກຈາກລາຍການ: ${removed.rows[0].item_name}`);
  }
  return { ok: true, message: "ຖອດອອກແລ້ວ" };
}

export type SaveCheckInput = {
  code: string;
  /** ອາການທີ່ຊ່າງວິເຄາະ */
  diagnosis: string;
  /** ຊ່າງຕັດສິນວ່າໝົດຮັບປະກັນ (ຕ້ອງມີເຫດຜົນ) */
  warranty_void: boolean;
  warranty_reason: string;
  use_spare: boolean;
};

/**
 * ບັນທຶກຜົນກວດເຊັກ — ຄັດລອກກົດເກນຈາກ actions/checking.saveCheck ທັງໝົດ:
 * ຕ້ອງຢູ່ຂັ້ນ 2 (`for update` ລັອກແຖວ), ຍ້າຍກະຕ່າຮ່າງ → tb_used_spare,
 * ແລະ status ໃໝ່ຕາມ (ໃຊ້ອາໄຫຼ່ × ປະກັນ).
 */
export async function saveCheckFlow(session: Session, input: SaveCheckInput): Promise<FlowResult> {
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  if (!input.diagnosis.trim()) return { ok: false, error: "ກະລຸນາປ້ອນ ອາການທີ່ຊ່າງວິເຄາະ" };

  const reason = input.warranty_reason.trim();
  if (input.warranty_void && !reason) {
    return { ok: false, error: "ກະລຸນາປ້ອນເຫດຜົນ ທີ່ຕັດສິນວ່າ ໝົດຮັບປະກັນ — ເປັນຫຼັກຖານເມື່ອລູກຄ້າຄ້ານ" };
  }

  const client = await db.connect();
  let spareCount = 0;
  try {
    await client.query("begin");

    const current = await client.query<{ stage: number; warrunty: string | null }>(
      `select (${STAGE_SQL})::int stage, a.warrunty from tb_product a where a.code=$1 for update`,
      [input.code],
    );
    if (current.rows[0]?.stage !== 2) {
      await client.query("rollback");
      return { ok: false, error: 'ບັນທຶກບໍ່ໄດ້ — ໃບນີ້ບໍ່ໄດ້ຢູ່ຂັ້ນ "ກຳລັງກວດເຊັກ"' };
    }

    // ປະກັນຫຼັງການຕັດສິນຂອງຊ່າງ — ໃຊ້ຄິດ status ຂອງຂັ້ນຕໍ່ໄປ
    const underWarranty = input.warranty_void ? false : current.rows[0]?.warrunty === "ຮັບປະກັນ";
    const status = input.use_spare ? (underWarranty ? 3 : 2) : underWarranty ? 4 : 2;

    if (input.use_spare) {
      const moved = await client.query(
        `insert into tb_used_spare(product_code, item_code, item_name, qty, unit_code)
         select product_code, item_code, item_name, qty, unit_code
           from ic_trans_detail_draft where user_created=$1 and product_code=$2`,
        [session.username, input.code],
      );
      spareCount = moved.rowCount ?? 0;
      if (spareCount === 0) {
        await client.query("rollback");
        return { ok: false, error: "ເລືອກວ່າໃຊ້ອາໄຫຼ່ ແຕ່ຍັງບໍ່ມີລາຍການອາໄຫຼ່" };
      }
      await client.query("delete from ic_trans_detail_draft where user_created=$1 and product_code=$2", [
        session.username,
        input.code,
      ]);
    } else {
      // ຖ້າປ່ຽນໃຈວ່າບໍ່ໃຊ້ ຢ່າປ່ອຍກະຕ່າຮ່າງຄ້າງໄປປົນກັບວຽກຄັ້ງຕໍ່ໄປ.
      await client.query("delete from ic_trans_detail_draft where user_created=$1 and product_code=$2", [
        session.username,
        input.code,
      ]);
    }

    await client.query(
      `update tb_product set time_finish_check=${NOW}, status=$1, issue_2=$2
         ${input.use_spare ? ", used_spare=1" : ""}
       where code=$3`,
      [status, input.diagnosis.trim(), input.code],
    );

    if (input.warranty_void) {
      await client.query("update tb_product set warrunty='ໝົດຮັບປະກັນ', warranty_reason=$1 where code=$2", [
        reason,
        input.code,
      ]);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveCheckFlow failed", error);
    return { ok: false, error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  const spareNote = input.use_spare ? `ໃຊ້ອາໄຫຼ່ ${spareCount} ລາຍການ` : "ບໍ່ໃຊ້ອາໄຫຼ່";
  const warrantyNote = input.warranty_void ? ` · ຊ່າງແຈ້ງວ່າໝົດຮັບປະກັນ ເຫດຜົນ: ${reason}` : "";
  await logChange("tb_product", input.code, `ບັນທຶກຜົນກວດເຊັກ: ${input.diagnosis.trim()} · ${spareNote}${warrantyNote}`);

  return { ok: true, message: `ບັນທຶກຜົນກວດເຊັກ ${input.code} ສຳເລັດ` };
}

/* ── ໃບຂໍເບີກອາໄຫຼ່ (SION · trans_flag 122) ─────────────────────── */

/**
 * ສ້າງໃບຂໍເບີກຈາກກະຕ່າ tb_used_spare — ຄັດລອກຈາກ actions/stock.saveRequest.
 * ຂໍ **ສະເພາະຈຳນວນທີ່ຍັງຄ້າງ** (OUTSTANDING_SPARES) ⇒ ບໍ່ຂໍຊ້ຳຂອງທີ່ເບີກອອກໄປແລ້ວ.
 */
export async function createSpareRequest(
  session: Session,
  input: { code: string; remark: string; wh_code: string; shelf_code: string },
): Promise<FlowResult & { doc_no?: string }> {
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  if (!input.wh_code || !input.shelf_code) return { ok: false, error: "ກະລຸນາເລືອກສາງ ແລະ ທີ່ເກັບ" };

  if (!odgDb) return { ok: false, error: "ບໍ່ພົບ ODG_DATABASE_URL" };

  const { date: docDate, at, time: docTime } = nowParts();
  const client = await db.connect();
  // ໃບຂໍເບີກຕ້ອງລົງ **ທັງ ODS ແລະ ERP** — ERP ບໍ່ຜ່ານ = ບໍ່ບັນທຶກເລີຍ (ເບິ່ງ lib/erp-request)
  const odg = await odgDb.connect();
  let docNo = "";
  let lineCount = 0;

  try {
    await client.query("begin");
    await odg.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    /**
     * ── ດ່ານ "ໝົດປະກັນຕ້ອງຈົບລາຄາກ່ອນ" ──
     * ໜ້າເວັບ /stock/requests ມີກົດນີ້ຢູ່ແລ້ວ ແຕ່ມັນເປັນພຽງ **ຕົວກອງລາຍການ**
     * (WAIT_WHERE — ຕັດສິນວ່າໃບໃດຂຶ້ນຄິວ) ບໍ່ແມ່ນດ່ານໃນ action ⇒ ເສັ້ນທາງ
     * **ແອັບມືຖື** (/api/mobile/spare-request) ຂໍເບີກໄດ້ໂດຍບໍ່ຜ່ານກົດນີ້ເລີຍ.
     *
     * ຜົນທີ່ຕາມມາຖ້າບໍ່ກັນ: ສາງຈ່າຍອາໄຫຼ່ອອກໃຫ້ງານໝົດປະກັນ → ລູກຄ້າປະຕິເສດລາຄາ
     * → ຂອງອອກຈາກສາງໄປແລ້ວ ໂດຍບໍ່ມີໃຜຈ່າຍ. ນີ້ຄືກໍລະນີທີ່ຄູ່ມືຂອງ lib/job-flow
     * ເຕືອນໄວ້ພໍດີ: "ແອັບຂຽນ SQL ຂອງຕົນເອງ ⇒ ຂາດເງື່ອນໄຂໃດເງື່ອນໄຂນຶ່ງ".
     *
     * `for update` ລັອກແຖວໄວ້ ⇒ ອະນຸມັດລາຄາພ້ອມກັບຂໍເບີກ ກໍ່ບໍ່ຫຼົບກັນ.
     */
    const job = await client.query<{ warrunty: string | null; quoted: boolean; cancelled: boolean; emp_code: string | null }>(
      `select a.warrunty, (a.qt_start is not null and a.qt_finish is not null) quoted, (a.status = 6) cancelled,
              a.emp_code
         from tb_product a where a.code = $1 for update`,
      [input.code],
    );
    const head = job.rows[0];
    if (!head) {
      await client.query("rollback");
      await odg.query("rollback");
      return { ok: false, error: "ບໍ່ພົບໃບຮັບເຄື່ອງນີ້" };
    }
    /**
     * ── ດ່ານ "ວຽກຂອງໃຜ" (17-07-2026) ──
     * ໃບເບີກນີ້ຕັດສະຕັອກ ERP ຈິງ ⇒ ຊ່າງຄົນນຶ່ງຫ້າມເບີກໃສ່ງານຂອງຊ່າງອີກຄົນ.
     * ໃຊ້ໂມເດວ scope ກາງ (lib/scope): ຊ່າງ (technical) ໄດ້ສະເພາະວຽກຕົນ · ຫົວໜ້າ/CS/ສາງ
     * ຊ່ວຍໄດ້ທຸກວຽກ. ແຕ່ກ່ອນ web path ນີ້**ບໍ່ກວດ**ເລີຍ ຂະນະທີ່ mobile (ownMobileJob)
     * ແລະ ຝັ່ງຕິດຕັ້ງ (createInstallSpareRequest) ກວດ ⇒ ຄວາມບໍ່ສົມມາດຄືບັກ ບໍ່ແມ່ນນະໂຍບາຍ.
     */
    if (!canViewAssignedJob(session, head.emp_code)) {
      await client.query("rollback");
      await odg.query("rollback");
      return { ok: false, error: "ວຽກນີ້ບໍ່ແມ່ນວຽກຂອງທ່ານ — ຂໍເບີກອາໄຫຼ່ບໍ່ໄດ້" };
    }
    if (head.cancelled) {
      await client.query("rollback");
      await odg.query("rollback");
      return { ok: false, error: "ໃບນີ້ຖືກຍົກເລີກແລ້ວ — ຂໍເບີກອາໄຫຼ່ບໍ່ໄດ້" };
    }
    if (head.warrunty === "ໝົດຮັບປະກັນ" && !head.quoted) {
      await client.query("rollback");
      await odg.query("rollback");
      return {
        ok: false,
        error: "ຂໍເບີກບໍ່ໄດ້ — ວຽກໝົດຮັບປະກັນຕ້ອງມີໃບສະເໜີລາຄາທີ່ລູກຄ້າຕົກລົງແລ້ວກ່ອນ",
      };
    }

    const lines = await client.query<{ item_code: string; item_name: string | null; unit_code: string | null; qty: string }>(
      OUTSTANDING_SPARES,
      [input.code],
    );
    if (lines.rows.length === 0) {
      await client.query("rollback");
      await odg.query("rollback");
      return { ok: false, error: "ບໍ່ມີອາໄຫຼ່ທີ່ຄ້າງຂໍເບີກ (ຂໍໄປແລ້ວ ຫຼື ເບີກອອກແລ້ວ)" };
    }
    lineCount = lines.rows.length;

    // ຫ້າມອອກ SIO ກ່ອນຂອງເຂົ້າສາງຈິງ: ກວດ ERP ສາງ+ບ່ອນເກັບທີ່ເລືອກ ຢູ່ server ອີກຄັ້ງ.
    const stock = await odg.query<{ code: string; balance_qty: string }>(
      `select i.code, coalesce(sum(coalesce(b.balance_qty,0)),0)::text balance_qty
         from unnest($1::text[]) i(code)
         left join lateral sml_ic_function_stock_balance_warehouse_location('2099-12-31',i.code,$2,$3) b on true
        group by i.code`,
      [lines.rows.map((line) => line.item_code), input.wh_code, input.shelf_code],
    );
    const available = new Map(stock.rows.map((row) => [row.code, Number(row.balance_qty)]));
    const shortage = lines.rows.filter((line) => (available.get(line.item_code) ?? 0) < Number(line.qty));
    if (shortage.length > 0) {
      await client.query("rollback");
      await odg.query("rollback");
      return {
        ok: false,
        error: `ຍັງຂໍເບີກບໍ່ໄດ້ — ERP ສາງ ${input.wh_code}/${input.shelf_code} ບໍ່ພໍ: ${shortage
          .map((line) => `${line.item_code} ຕ້ອງການ ${Number(line.qty)} ມີ ${available.get(line.item_code) ?? 0}`)
          .join(", ")} · ຕ້ອງສັ່ງຊື້ ແລະຮັບເຂົ້າສາງກ່ອນ`,
      };
    }

    docNo = await nextDocNo(client, "SIO", at);
    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, product_code, remark, user_created, wh_code, shelf_code)
       values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [TRANS.REQUEST, docDate, docNo, input.code, input.remark, session.username, input.wh_code, input.shelf_code],
    );
    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag, doc_date, doc_no, product_code, item_code, item_name, qty, unit_code, calc_flag, user_created, status)
         values($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10)`,
        [
          TRANS.REQUEST, docDate, docNo, input.code, line.item_code, line.item_name, line.qty, line.unit_code,
          session.username, LINE_STATUS.PENDING,
        ],
      );
    }
    await client.query(
      `update tb_used_spare set reg_start=${NOW}
        where product_code=$1 and reg_start is null and item_code = any($2::varchar[])`,
      [input.code, lines.rows.map((line) => line.item_code)],
    );
    await client.query(`update tb_product set spare_reg=${NOW} where code=$1`, [input.code]);

    await writeErpRequest(
      {
        doc_no: docNo, doc_date: docDate, doc_time: docTime,
        job_code: input.code, wh_code: input.wh_code, shelf_code: input.shelf_code,
        remark: input.remark, requester: session.username, lines: lines.rows,
      },
      odg,
    );

    await client.query("commit");
    await odg.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await odg.query("rollback").catch(() => {});
    console.error("createSpareRequest failed", error);
    return { ok: false, error: "ບັນທຶກບໍ່ສຳເລັດ — ERP ບໍ່ຮັບໃບຂໍເບີກນີ້ (ບໍ່ໄດ້ບັນທຶກຫຍັງເລີຍ)" };
  } finally {
    client.release();
    odg.release();
  }

  // ສາງຕ້ອງເບີກໃຫ້ — ບໍ່ດັ່ງນັ້ນໃບຂໍນອນຢູ່ບໍ່ມີໃຜເຫັນ
  await logChange(
    jobModel(input.code),
    input.code,
    `ສ້າງໃບຂໍເບີກ ${docNo} · ອາໄຫຼ່ ${lineCount} ລາຍການ${input.remark ? ` · ${input.remark}` : ""}`,
    { roles: ROLE_WAREHOUSE },
  );
  return { ok: true, message: `ສ້າງໃບຂໍເບີກ ${docNo} (${lineCount} ລາຍການ)`, doc_no: docNo };
}

/** ໃບຂໍເບີກອາໄຫຼ່ຂອງງານຕິດຕັ້ງ — ໃຊ້ກົດ outstanding ດຽວກັນ. */
export async function createInstallSpareRequest(
  session: Session,
  input: { code: string; remark: string; wh_code: string; shelf_code: string },
): Promise<FlowResult & { doc_no?: string }> {
  if (!db || !odgDb) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL / ODG_DATABASE_URL" };
  if (!input.wh_code || !input.shelf_code) return { ok: false, error: "ກະລຸນາເລືອກສາງ ແລະ ທີ່ເກັບ" };
  const { date: docDate, at, time: docTime } = nowParts();
  const client = await db.connect();
  const odg = await odgDb.connect();
  let docNo = "";
  let lineCount = 0;
  try {
    await client.query("begin");
    await odg.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);
    const owner = await client.query<{ accepted: boolean }>(
      `select tech_confirm is not null accepted from ods_tb_install
        where code=$1 and tech_code=$2 and cancel_date is null and job_finish is null for update`,
      [input.code, session.username],
    );
    if (!owner.rows[0]?.accepted) {
      await client.query("rollback");
      return { ok: false, error: "ຕ້ອງຮັບງານຕິດຕັ້ງກ່ອນຂໍເບີກອາໄຫຼ່" };
    }
    const lines = await client.query<{
      item_code: string;
      item_name: string | null;
      unit_code: string | null;
      qty: string;
    }>(OUTSTANDING_SPARES, [input.code]);
    if (lines.rows.length === 0) {
      await client.query("rollback");
      return { ok: false, error: "ບໍ່ມີອາໄຫຼ່ທີ່ຄ້າງຂໍເບີກ" };
    }
    docNo = await nextDocNo(client, "SION", at);
    lineCount = lines.rows.length;
    await client.query(
      `insert into ic_trans(trans_flag,doc_date,doc_no,product_code,remark,status,used_status,user_created,job_type,wh_code,shelf_code)
       values($1,$2,$3,$4,$5,0,1,$6,'install',$7,$8)`,
      [TRANS.REQUEST, docDate, docNo, input.code, input.remark, session.username, input.wh_code, input.shelf_code],
    );
    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag,doc_date,doc_no,product_code,item_code,item_name,qty,unit_code,calc_flag,status,user_created,job_type)
         values($1,$2,$3,$4,$5,$6,$7,$8,1,0,$9,'install')`,
        [TRANS.REQUEST, docDate, docNo, input.code, line.item_code, line.item_name, line.qty, line.unit_code, session.username],
      );
    }
    await client.query(
      `update tb_used_spare set reg_start=${NOW}
        where product_code=$1 and reg_start is null and item_code=any($2::varchar[])`,
      [input.code, lines.rows.map((line) => line.item_code)],
    );
    await client.query(`update ods_tb_install set reg_start=coalesce(reg_start,${NOW}) where code=$1`, [input.code]);
    await client.query(`update ods_tb_install_detail set reg_start=coalesce(reg_start,${NOW}) where code=$1`, [input.code]);

    await writeErpRequest(
      {
        doc_no: docNo, doc_date: docDate, doc_time: docTime,
        job_code: input.code, wh_code: input.wh_code, shelf_code: input.shelf_code,
        remark: input.remark, requester: session.username, lines: lines.rows,
      },
      odg,
    );

    await client.query("commit");
    await odg.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await odg.query("rollback").catch(() => {});
    console.error("createInstallSpareRequest failed", error);
    return { ok: false, error: "ສ້າງໃບຂໍເບີກບໍ່ສຳເລັດ — ERP ບໍ່ຮັບໃບນີ້ (ບໍ່ໄດ້ບັນທຶກຫຍັງເລີຍ)" };
  } finally {
    client.release();
    odg.release();
  }
  await logChange(
    "ods_tb_install",
    input.code,
    `ສ້າງໃບຂໍເບີກ ${docNo} · ອາໄຫຼ່ ${lineCount} ລາຍການ`,
    { roles: ROLE_WAREHOUSE },
  );
  return { ok: true, message: `ສ້າງໃບຂໍເບີກ ${docNo} (${lineCount} ລາຍການ)`, doc_no: docNo };
}

/* ── ຊ່າງຮັບອາໄຫຼ່ (PISP · 166) ─────────────────────────────────── */

/** ໃບເບີກທີ່ສາງຈ່າຍໃຫ້ແລ້ວ ແຕ່ຊ່າງຍັງບໍ່ໄປຮັບ — ຄິວ "ຮັບອາໄຫຼ່" ຂອງຊ່າງ */
export type PickupDoc = {
  workflow: "install" | "repair";
  doc_no: string;
  job_code: string;
  doc_date: string;
  lines: number;
};

export async function pickupQueue(session: Session): Promise<PickupDoc[]> {
  return (
    await query<PickupDoc>(
      `select 'repair'::varchar workflow, ic.doc_no, ic.product_code as job_code,
          to_char(ic.doc_date,'DD-MM-YYYY') as doc_date,
          (select count(*)::int from ic_trans_detail d where d.doc_no = ic.doc_no and d.trans_flag = ${TRANS.DISPATCH}) as lines
        from ic_trans ic
        join tb_product p on p.code = ic.product_code
       where ic.trans_flag = ${TRANS.DISPATCH}
         and (ic.job_type is null or ic.job_type <> 'install')
         and not exists (select 1 from ic_trans k where k.trans_flag = ${TRANS_PICK} and k.doc_ref = ic.doc_no)
         and p.emp_code = $1
       union all
       select 'install'::varchar workflow, ic.doc_no, ic.product_code as job_code,
          to_char(ic.doc_date,'DD-MM-YYYY') as doc_date,
          (select count(*)::int from ic_trans_detail d where d.doc_no=ic.doc_no and d.trans_flag=${TRANS.DISPATCH}) lines
         from ic_trans ic
         join ods_tb_install i on i.code=ic.product_code
        where ic.trans_flag=${TRANS.DISPATCH} and ic.job_type='install'
          and not exists (select 1 from ic_trans k where k.trans_flag=${TRANS_PICK} and k.doc_ref=ic.doc_no)
          and i.tech_code=$1
       order by doc_date asc`,
      [session.username],
    )
  ).rows;
}

/**
 * ຊ່າງກົດຮັບອາໄຫຼ່ — ຄັດລອກຈາກ actions/stock.savePickSpare.
 * ບໍ່ແຕະ ic_inventory: ສະຕັອກຖືກຕັດໄປແລ້ວຕອນສາງເບີກ (56).
 */
export async function pickupSpares(session: Session, docRef: string, remark: string): Promise<FlowResult> {
  if (!db) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL" };
  if (!docRef) return { ok: false, error: "ບໍ່ພົບເລກທີໃບເບີກ" };

  const { date: docDate, at, time: docTime } = nowParts();
  const client = await db.connect();
  let pickNo = "";
  let productCode = "";
  let pickLines = 0;
  let workflow: "install" | "repair" = "repair";

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    const head = (
      await client.query<{ product_code: string | null; workflow: "install" | "repair" }>(
        `select ic.product_code,
                case when ic.job_type='install' then 'install' else 'repair' end workflow
           from ic_trans ic
          where ic.doc_no=$1 and ic.trans_flag=$2
            and (
              (ic.job_type='install' and exists (
                select 1 from ods_tb_install i where i.code=ic.product_code and i.tech_code=$3
              ))
              or
              ((ic.job_type is null or ic.job_type<>'install') and exists (
                select 1 from tb_product p where p.code=ic.product_code and p.emp_code=$3
              ))
            )
          limit 1`,
        [docRef, TRANS.DISPATCH, session.username],
      )
    ).rows[0];
    if (!head?.product_code) {
      await client.query("rollback");
      return { ok: false, error: "ບໍ່ພົບໃບເບີກອາໄຫຼ່" };
    }
    productCode = head.product_code;
    workflow = head.workflow;

    const already = await client.query<{ count: number }>(
      "select count(*)::int count from ic_trans where trans_flag=$1 and doc_ref=$2",
      [TRANS_PICK, docRef],
    );
    if (already.rows[0]?.count) {
      await client.query("rollback");
      return { ok: false, error: "ໃບນີ້ຮັບອາໄຫຼ່ໄປແລ້ວ" };
    }

    const lines = await client.query<{ item_code: string; item_name: string | null; unit_code: string | null; qty: string }>(
      `select item_code, item_name, unit_code, qty from ic_trans_detail
        where doc_no=$1 and trans_flag=$2 order by roworder asc`,
      [docRef, TRANS.DISPATCH],
    );
    if (lines.rows.length === 0) {
      await client.query("rollback");
      return { ok: false, error: "ບໍ່ມີອາໄຫຼ່ໃນໃບນີ້" };
    }
    pickLines = lines.rows.length;

    pickNo = await nextDocNo(client, "PISP", at);
    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, product_code, remark, user_created, status, job_type)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        TRANS_PICK,
        docDate,
        pickNo,
        docRef,
        productCode,
        remark,
        session.username,
        LINE_STATUS.PENDING,
        workflow === "install" ? "install" : null,
      ],
    );

    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref, product_code,
           item_code, item_name, qty, unit_code, calc_flag, user_created, status, job_type)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11,$12)`,
        [
          TRANS_PICK, docDate, pickNo, docRef, productCode, line.item_code, line.item_name, line.qty, line.unit_code,
          session.username, LINE_STATUS.ISSUED, workflow === "install" ? "install" : null,
        ],
      );
      await client.query(
        `update tb_used_spare
            set pick_finish=${NOW}, reg_finish=coalesce(reg_finish, ${NOW})
          where roworder = (
            select roworder from tb_used_spare
             where product_code=$1 and item_code=$2 and pick_finish is null
             order by (reg_finish is not null) desc, (qty = $3::numeric) desc, roworder asc limit 1)`,
        [productCode, line.item_code, line.qty],
      );
    }

    if (workflow === "install") {
      const unpicked = await client.query<{ count: number }>(
        `select count(*)::int count from ic_trans t
          where t.trans_flag=$1 and t.product_code=$2 and t.job_type='install'
            and not exists (select 1 from ic_trans p where p.trans_flag=$3 and p.doc_ref=t.doc_no)`,
        [TRANS.DISPATCH, productCode, TRANS_PICK],
      );
      if (!unpicked.rows[0]?.count) {
        await client.query(`update ods_tb_install set pick_finish=${NOW} where code=$1`, [productCode]);
        await client.query(`update ods_tb_install_detail set pick_finish=${NOW} where code=$1`, [productCode]);
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("pickupSpares failed", error);
    return { ok: false, error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  await logChange(
    jobModel(productCode),
    productCode,
    `ຊ່າງຮັບອາໄຫຼ່ ${pickNo} · ${pickLines} ລາຍການ (ອ້າງອີງໃບເບີກ ${docRef})`,
  );
  return { ok: true, message: `ຮັບອາໄຫຼ່ແລ້ວ (ໃບ ${pickNo} · ${pickLines} ລາຍການ)` };
}


/* ── ໃບຂໍສົ່ງຄືນອາໄຫຼ່ (SRI · trans_flag 59) — ຈາກ **ແອັບຊ່າງ** ────────
 *
 * ── ເປັນຫຍັງ ──
 * ອາໄຫຼ່ທີ່ສາງເບີກອອກໄປແລ້ວ ແຕ່ຊ່າງບໍ່ໄດ້ໃຊ້ ຕ້ອງມີໃບສົ່ງຄືນ — ບໍ່ດັ່ງນັ້ນ
 * **ອາໄຫຼ່ຄ້າງຢູ່ນຳຊ່າງ ໂດຍບໍ່ມີເອກະສານ** (ຂໍ້ມູນຈິງ: ງານທີ່ຍົກເລີກແລ້ວມີອາໄຫຼ່ 36 ແຖວ
 * ທີ່ບໍ່ເຄີຍມີໃບສົ່ງຄືນຈັກໃບ). ເມື່ອກ່ອນເຮັດໄດ້ແຕ່ຢູ່ເວັບ ⇒ ຊ່າງທີ່ຢູ່ໜ້າງານເຮັດບໍ່ໄດ້.
 *
 * ນະໂຍບາຍ 13-07-2026: ໃບ**ຂໍ** (59) ລົງທັງ ODS ແລະ ERP · ໃບ**ຮັບຄືນ** (58) ສາງເຮັດຢູ່ ERP
 * ແລ້ວ ODS ດຶງມາເອງ (lib/erp-dispatch → syncErpReturns).
 */

/** ອາໄຫຼ່ທີ່ **ຢູ່ນຳຊ່າງ** — ເບີກອອກໄປແລ້ວ ແລະ ຍັງບໍ່ໄດ້ຂໍສົ່ງຄືນ */
export async function outstandingSpares(code: string) {
  return (
    await query<{ doc_no: string; item_code: string; item_name: string; qty: string; unit_code: string | null }>(
      `select d.doc_no, d.item_code, d.item_name, d.qty::text as qty, d.unit_code
         from ic_trans_detail d
         join ic_trans t on t.doc_no = d.doc_no and t.trans_flag = d.trans_flag
        where t.trans_flag = ${TRANS.DISPATCH} and t.product_code = $1
          and d.status = ${LINE_STATUS.PENDING}
        order by d.roworder`,
      [code],
    )
  ).rows;
}

export async function createSpareReturn(
  session: Session,
  input: { code: string; remark: string; items: { item_code: string; qty: number }[] },
): Promise<FlowResult & { doc_no?: string }> {
  if (!db || !odgDb) return { ok: false, error: "ບໍ່ພົບ DATABASE_URL / ODG_DATABASE_URL" };
  if (input.items.length === 0) return { ok: false, error: "ບໍ່ໄດ້ເລືອກອາໄຫຼ່ທີ່ຈະສົ່ງຄືນ" };

  const { date: docDate, at, time: docTime } = nowParts();
  const client = await db.connect();
  const odg = await odgDb.connect();
  let docNo = "";

  try {
    await client.query("begin");
    await odg.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [DOC_LOCK]);

    // ອາໄຫຼ່ທີ່ຂໍຄືນ ຕ້ອງເປັນອາໄຫຼ່ **ຂອງງານນີ້ ທີ່ຍັງຢູ່ນຳຊ່າງຈິງ** (ບໍ່ດັ່ງນັ້ນສະຕັອກເກີນ)
    const wanted = new Map(input.items.map((item) => [item.item_code, item.qty]));
    const lines = (await outstandingSpares(input.code)).filter((line) => wanted.has(line.item_code));
    if (lines.length === 0) {
      await client.query("rollback");
      await odg.query("rollback");
      return { ok: false, error: "ບໍ່ມີອາໄຫຼ່ຂອງງານນີ້ທີ່ຄ້າງຢູ່ນຳຊ່າງ" };
    }

    docNo = await nextDocNo(client, "SRI", at);

    await client.query(
      `insert into ic_trans(trans_flag, doc_date, doc_no, doc_ref, doc_ref_date, product_code, remark, user_created, status)
       values($1,$2,$3,$4,$2,$5,$6,$7,0)`,
      [TRANS.RETURN_REQUEST, docDate, docNo, lines[0].doc_no, input.code, input.remark, session.username],
    );

    for (const line of lines) {
      const qty = Math.min(Number(wanted.get(line.item_code) ?? 0), Number(line.qty));
      if (qty <= 0) continue;
      await client.query(
        `insert into ic_trans_detail(trans_flag, doc_date, doc_no, doc_ref, product_code, item_code, item_name,
           qty, unit_code, calc_flag, user_created, status)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11)`,
        [TRANS.RETURN_REQUEST, docDate, docNo, line.doc_no, input.code, line.item_code, line.item_name, qty,
          line.unit_code, session.username, LINE_STATUS.RETURN_REQUESTED],
      );
      // ແຖວຂອງໃບເບີກ = ຂໍຄືນແລ້ວ ⇒ ບໍ່ໃຫ້ຂໍຊ້ຳ
      await client.query(
        `update ic_trans_detail set status=$1
          where doc_no=$2 and trans_flag=${TRANS.DISPATCH} and item_code=$3 and status=${LINE_STATUS.PENDING}`,
        [LINE_STATUS.RETURN_REQUESTED, line.doc_no, line.item_code],
      );
    }

    await writeErpRequest(
      {
        trans_flag: TRANS.RETURN_REQUEST,
        format: ERP.FORMAT_RETURN,
        doc_no: docNo,
        doc_date: docDate,
        doc_time: docTime,
        job_code: input.code,
        wh_code: RETURN_WH,
        shelf_code: RETURN_SHELF,
        remark: input.remark || `ສົ່ງຄືນອາໄຫຼ່ຂອງງານ ${input.code}`,
        requester: session.username,
        lines: lines.map((line) => ({
          item_code: line.item_code,
          item_name: line.item_name,
          unit_code: line.unit_code,
          qty: Math.min(Number(wanted.get(line.item_code) ?? 0), Number(line.qty)),
        })),
      },
      odg,
    );

    await client.query("commit");
    await odg.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await odg.query("rollback").catch(() => {});
    console.error("createSpareReturn failed", error);
    return { ok: false, error: "ສ້າງໃບຂໍສົ່ງຄືນບໍ່ສຳເລັດ" };
  } finally {
    client.release();
    odg.release();
  }

  // ສາງຕ້ອງຮັບຄືນ (ຢູ່ ERP) — ບອກໃຫ້ຮູ້
  await logChange(jobModel(input.code), input.code, `ຊ່າງຂໍສົ່ງຄືນອາໄຫຼ່ ${docNo}`, { roles: ROLE_WAREHOUSE });
  return { ok: true, message: `ສ້າງໃບຂໍສົ່ງຄືນ ${docNo}`, doc_no: docNo };
}
