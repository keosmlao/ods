import { query, queryOdg } from "@/lib/db";
import { REPAIR_WH_LABEL } from "@/lib/repair-stock-cache";
import { TRANS } from "@/lib/stock-constants";

/**
 * ── ສາງສູນບໍລິການ + ລາຍການອາໄຫຼ່ ສຳລັບແອັບຜູ້ຈັດການ ──
 *
 * ອ່ານ **cache ອັນດຽວກັບໜ້າເວັບ** (`ods_repair_stock_cache`, ເບິ່ງ lib/repair-stock-cache)
 * ⇒ ຕົວເລກ 2 ຝັ່ງບໍ່ມີທາງຫຼົ້ນກັນ ແລະ ບໍ່ຕ້ອງລໍ ERP ຄິດຍອດ (~25ວິ) ຕອນເປີດແອັບ.
 *
 * ⚠️ **ຕັດເປັນໜ້າຢູ່ SQL** ບໍ່ແມ່ນສົ່ງ 1,141 ລາຍການລົງມືຖືແລ້ວຕັດຢູ່ນັ້ນ —
 * ຝັ່ງເວັບຕັດຢູ່ client ໄດ້ເພາະໂຫຼດທັງກ້ອນຢູ່ແລ້ວ, ແຕ່ມືຖືຢູ່ນອກຫ້ອງການ
 * ⇒ ສົ່ງທັງກ້ອນທຸກເທື່ອຄື ເປືອງເນັດ ແລະ ຊ້າ.
 */

export type RepairStockRow = {
  code: string;
  name: string;
  unit_code: string | null;
  total: number;
  /** ຍອດແຍກຕາມສູນ — ໃຫ້ເຫັນວ່າຂອງຢູ່ຂົວຫຼວງ ຫຼື ດອນຕີ້ວ ໂດຍບໍ່ຕ້ອງເປີດລາຍລະອຽດ */
  centers: { code: string; name: string; qty: number }[];
  /** ຊື່ເກົ່າຂອງ `centers` — ໜ້າຊ່າງລຸ້ນກ່ອນອ່ານຊື່ນີ້ (ຢ່າຖອດອອກ) */
  warehouses: { code: string; name: string; qty: number }[];
};

export type RepairStockList = {
  items: RepairStockRow[];
  total: number;
  page: number;
  pages: number;
  refreshed_at: string | null;
  /** ຕົວກອງທີ່ມີ — ນັບຈາກ cache ທັງໝົດ ບໍ່ແມ່ນສະເພາະໜ້ານີ້ */
  centers: { code: string; name: string; items: number }[];
  shelves: { code: string; name: string; items: number }[];
};

const PER_PAGE = 30;

/**
 * @param q     ຄົ້ນ ຊື່ ຫຼື ລະຫັດ
 * @param wh    ກອງສູນ (1104 · 1206) — ວ່າງ = ທຸກສູນ
 * @param loc   ກອງທີ່ຈັດເກັບ (110411 …) — ໃຊ້ຮ່ວມກັບ wh
 * @param page  ໜ້າ (ເລີ່ມ 1) — **0 = ບໍ່ຕັດໜ້າ ຄືນທັງໝົດ** (ໜ້າຊ່າງລຸ້ນກ່ອນ)
 */
export async function repairStockList(q = "", wh = "", loc = "", page = 1): Promise<RepairStockList> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (q.trim()) {
    args.push(`%${q.trim()}%`);
    where.push(`(item_code ilike $${args.length} or item_name ilike $${args.length})`);
  }
  if (wh.trim()) {
    args.push(wh.trim());
    where.push(`wh_code = $${args.length}`);
  }
  if (loc.trim()) {
    args.push(loc.trim());
    where.push(`coalesce(location,'') = $${args.length}`);
  }
  const filter = where.length ? `where ${where.join(" and ")}` : "";

  /**
   * ນັບ **ຈຳນວນອາໄຫຼ່ (item)** ບໍ່ແມ່ນຈຳນວນແຖວ — 1 ອາໄຫຼ່ຢູ່ໄດ້ຫຼາຍທີ່ຈັດເກັບ
   * ⇒ ນັບແຖວແລ້ວຈະໄດ້ຕົວເລກໃຫຍ່ກວ່າຄວາມຈິງ ແລະ ບໍ່ຕົງກັບໜ້າເວັບ.
   */
  const total = (
    await query<{ n: number }>(
      `select count(distinct item_code)::int n from ods_repair_stock_cache ${filter}`,
      args,
    )
  ).rows[0]?.n ?? 0;

  const all = page <= 0;
  const pages = all ? 1 : Math.max(1, Math.ceil(total / PER_PAGE));
  const current = all ? 1 : Math.min(Math.max(1, page), pages);
  const window = all ? "" : `limit ${PER_PAGE} offset ${(current - 1) * PER_PAGE}`;

  const rows = (
    await query<{ item_code: string; item_name: string | null; unit_code: string | null; total: number }>(
      `select item_code, max(item_name) item_name, max(unit_code) unit_code, sum(qty)::float8 total
         from ods_repair_stock_cache ${filter}
        group by item_code
        order by max(item_name) nulls last, item_code
        ${window}`,
      args,
    )
  ).rows;

  // ຍອດຕໍ່ສູນ ຂອງສະເພາະລາຍການໃນໜ້ານີ້ (ຮອບດຽວ ບໍ່ແມ່ນ query ຕໍ່ແຖວ)
  const codes = rows.map((row) => row.item_code);
  const centerRows = codes.length
    ? (
        await query<{ item_code: string; wh_code: string; qty: number }>(
          `select item_code, wh_code, sum(qty)::float8 qty from ods_repair_stock_cache
            where item_code = any($1) group by item_code, wh_code`,
          [codes],
        )
      ).rows
    : [];
  const centerOf = new Map<string, RepairStockRow["centers"]>();
  for (const row of centerRows) {
    const list = centerOf.get(row.item_code) ?? [];
    list.push({ code: row.wh_code, name: REPAIR_WH_LABEL[row.wh_code] ?? row.wh_code, qty: row.qty });
    centerOf.set(row.item_code, list);
  }

  const [centers, shelves, meta] = await Promise.all([
    query<{ code: string; items: number }>(
      `select wh_code as code, count(distinct item_code)::int items from ods_repair_stock_cache group by wh_code order by wh_code`,
    ),
    query<{ code: string; name: string; items: number }>(
      /* ⚠️ `name` ເປັນຊື່ຊະນິດຂໍ້ມູນຂອງ PG ⇒ ໃຊ້ເປັນຊື່ຫຍໍ້ລ້ວນບໍ່ໄດ້ ຕ້ອງມີ `as`
         (ບັນຫາແບບດຽວກັບ `current` ທີ່ເຄີຍພັງໜ້າໃບງານ — ເບິ່ງ lib/job-center) */
      `select coalesce(location,'') as code, coalesce(max(location_name),'') as name,
              count(distinct item_code)::int items
         from ods_repair_stock_cache ${wh.trim() ? "where wh_code = $1" : ""}
        group by coalesce(location,'') order by 1`,
      wh.trim() ? [wh.trim()] : [],
    ),
    query<{ reftime: string | null }>(
      `select to_char(max(refreshed_at),'DD-MM-YYYY HH24:MI') reftime from ods_repair_stock_cache`,
    ),
  ]);

  return {
    items: rows.map((row) => ({
      code: row.item_code,
      name: row.item_name ?? row.item_code,
      unit_code: row.unit_code,
      total: row.total,
      centers: (centerOf.get(row.item_code) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
      warehouses: (centerOf.get(row.item_code) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
    })),
    total,
    page: current,
    pages,
    refreshed_at: meta.rows[0]?.reftime ?? null,
    centers: centers.rows.map((row) => ({
      code: row.code,
      name: REPAIR_WH_LABEL[row.code] ?? row.code,
      items: row.items,
    })),
    shelves: shelves.rows,
  };
}

export type RepairStockDetail = {
  code: string;
  name: string;
  unit_code: string | null;
  total: number;
  /** ຢູ່ບ່ອນໃດ ຈັກອັນ — ຄຳຖາມຫຼັກຂອງໜ້ານີ້ */
  places: { wh_code: string; wh_name: string; location: string; location_name: string; qty: number }[];
  /** ຄວາມເຄື່ອນໄຫວລ່າສຸດຢູ່ສາງສູນບໍລິການ (ERP) — ວ່າງ ຖ້າ ERP ອ່ານບໍ່ໄດ້ */
  moves: { doc_no: string; doc_date: string | null; kind: string; qty: number; wh_code: string }[];
};

/** ປ້າຍຂອງ trans_flag ທີ່ພົບຢູ່ສາງສ້ອມ — ບໍ່ຮູ້ຈັກ ⇒ ສະແດງເລກ (ຢ່າເດົາ) */
const MOVE_LABEL: Record<number, string> = {
  [TRANS.REQUEST]: "ໃບຂໍເບີກ",
  [TRANS.DISPATCH]: "ເບີກອອກ",
  [TRANS.RECEIVE_BACK]: "ຮັບຄືນເຂົ້າສາງ",
  [TRANS.RETURN_REQUEST]: "ຂໍສົ່ງຄືນ",
  [TRANS.TRANSFER]: "ໂອນຍ້າຍສາງ",
  12: "ຮັບເຂົ້າຈາກການຊື້",
  54: "ຮັບເຂົ້າ",
  44: "ຂາຍ",
};

export async function repairStockDetail(code: string): Promise<RepairStockDetail | null> {
  const rows = (
    await query<{
      item_name: string | null;
      unit_code: string | null;
      wh_code: string;
      location: string | null;
      location_name: string | null;
      qty: number;
    }>(
      /* `location` ຕ້ອງໃສ່ວົງຢືມ — ຄືກັບ lib/repair-stock-cache (PG ຖືເປັນຄຳສະຫງວນ) */
      `select item_name, unit_code, wh_code, coalesce(location,'') as "location",
              coalesce(location_name,'') as location_name, qty::float8 qty
         from ods_repair_stock_cache where item_code = $1
        order by wh_code, location`,
      [code],
    )
  ).rows;
  if (!rows.length) return null;

  // ຄວາມເຄື່ອນໄຫວ — ERP ລົ້ມ ⇒ ຍັງເປີດໜ້າໄດ້ ພຽງແຕ່ບໍ່ມີປະຫວັດ (ຫຼັກການດຽວກັບ lib/erp-purchase)
  let moves: RepairStockDetail["moves"] = [];
  try {
    moves = (
      await queryOdg<{ doc_no: string; doc_date: string | null; trans_flag: number; qty: number; wh_code: string }>(
        `select d.doc_no, to_char(d.doc_date,'DD-MM-YYYY') doc_date, d.trans_flag,
                d.qty::float8 qty, d.wh_code
           from ic_trans_detail d
          where d.item_code = $1 and d.wh_code in ('1104','1206')
          order by d.doc_date desc nulls last
          limit 15`,
        [code],
      )
    ).rows.map((row) => ({
      doc_no: row.doc_no,
      doc_date: row.doc_date,
      kind: MOVE_LABEL[row.trans_flag] ?? `flag ${row.trans_flag}`,
      qty: row.qty,
      wh_code: row.wh_code,
    }));
  } catch (error) {
    console.error("repairStockDetail moves failed", error);
  }

  return {
    code,
    name: rows[0].item_name ?? code,
    unit_code: rows[0].unit_code,
    total: rows.reduce((sum, row) => sum + row.qty, 0),
    places: rows.map((row) => ({
      wh_code: row.wh_code,
      wh_name: REPAIR_WH_LABEL[row.wh_code] ?? row.wh_code,
      location: row.location ?? "",
      location_name: row.location_name ?? "",
      qty: row.qty,
    })),
    moves,
  };
}
