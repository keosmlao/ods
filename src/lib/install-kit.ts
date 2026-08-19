import "server-only";

import { query, queryOdg } from "@/lib/db";

/**
 * ── ຊຸດອາໄຫຼ່ມາດຕະຖານຂອງງານຕິດຕັ້ງ (`used_spare_install`) ──
 *
 * ຄີຄື `install_type` (9900-00xx) ແບ່ງຕາມ **ຂະໜາດ BTU** ຂອງແອ. ຕອນເປີດງານ
 * `createInstall` (actions/installation) ກ໋ອບຊຸດຂອງ install_type ນັ້ນລົງກະຕ່າ
 * `tb_used_spare` ⇒ ແກ້ຊຸດຢູ່ນີ້ = ແກ້ສິ່ງທີ່ **ງານໃໝ່**ຈະໄດ້ຮັບ (ງານເກົ່າບໍ່ຖືກແຕະ).
 *
 * ⚠️ ຊຸດຫວ່າງ = `used_spare` ຂອງງານໃໝ່ຖືກຕັ້ງເປັນ 0 ⇒ ງານ**ຂ້າມຂັ້ນເບີກອາໄຫຼ່ໄປເລີຍ**
 * (lib/install-stage ຂັ້ນ 2/3) ⇒ ບໍ່ໂຜ່ຢູ່ໜ້າ /work/install-spares ອີກ. ຍົກເວັ້ນແອ
 * (ລະຫັດ 12xx) ທີ່ບັງຄັບໃຫ້ເຂົ້າຂະບວນການສະເໝີ. ນີ້ຄືເຫດຜົນທີ່ໜ້າຈັດການນີ້ຕ້ອງ
 * ສະແດງ**ຊຸດທີ່ຍັງບໍ່ມີລາຍການ**ນຳ ບໍ່ແມ່ນສະແດງແຕ່ຊຸດທີ່ມີແຖວ.
 *
 * ── 19-08-2026: ໝວດຊຸດ **ຈັດການໄດ້ແລ້ວ** ──
 * ເມື່ອກ່ອນ 5 ໝວດຝັງຢູ່ `INSTALL_KIT_TYPES` ໃນໄຟລ໌ນີ້ ⇒ ເພີ່ມໝວດຕ້ອງແກ້ໂຄ້ດ.
 * ດຽວນີ້ຢູ່ຕາຕະລາງ `ods.install_kit_type` (ເບິ່ງ migrations/2026-08-19-install-kit-types).
 */

/** ຊື່ເມນູ — ຕ້ອງຕົງກັບ PERMISSION_RESOURCES (lib/permission-catalog) */
export const INSTALL_KIT_MENU = "/manage/install-kits";

export type InstallKitType = {
  install_type: string;
  name_1: string;
  /** `ic_size.code` ຂອງ ERP ທີ່ໝວດນີ້ຄຸມ — null = ບໍ່ຈັບຄູ່ບິນອັດຕະໂນມັດ */
  ic_size: string | null;
  sort_order: number;
  active: boolean;
};

/**
 * ── ດ່ານກັນ SQL injection ຂອງຄ່າທີ່ຈະຖືກ**ຕໍ່ເຂົ້າ SQL** ──
 *
 * `install_type` ກັບ `ic_size` ຖືກຕໍ່ເປັນ string literal ໃສ່ `case ... end`
 * (ເບິ່ງ installTypeCaseSql — ຈຳເປັນເພາະ join ຂ້າມຖານບໍ່ໄດ້) ⇒ ຕໍ່ค่าจาก DB
 * ໂດຍບໍ່ກວດ = ຮູຮັ່ວ ຖ້າມີໃຜ insert ຄ່າແປກເຂົ້າຕາຕະລາງ.
 * ອະນຸຍາດແຕ່ ຕົວອັກສອນ-ເລກ-ຂີດ ເທົ່ານັ້ນ (ຮູບແບບຈິງ: `9900-0016` · `121`).
 */
const SAFE_CODE = /^[A-Za-z0-9-]{1,25}$/;
export const isSafeKitCode = (value: string) => SAFE_CODE.test(value);

/**
 * ── ໝວດຕັ້ງຕົ້ນ 5 ອັນ = **ຕາໜ່າງກັນຕົກ** ເມື່ອຍັງບໍ່ໄດ້ແລ່ນ migration ──
 *
 * ຄ່າດຽວກັບທີ່ເຄີຍ hardcode ໄວ້ ແລະ ດຽວນີ້ຖືກ seed ລົງຕາຕະລາງ
 * (migrations/2026-08-19-install-kit-types.sql).
 *
 * ⚠️ ຢ່າຖອດອອກຈົນກວ່າແນ່ໃຈວ່າທຸກ environment ແລ່ນ migration ແລ້ວ: ຖ້າຕາຕະລາງບໍ່ມີ
 * ແລ້ວຄືນ array ຫວ່າງ `installTypeCaseSql` ຈະຄືນ `''` ໃຫ້ **ທຸກບິນ** ⇒ ງານໃໝ່ທຸກໃບ
 * ບໍ່ໄດ້ຊຸດອາໄຫຼ່ ໂດຍ**ບໍ່ມີ error ໃຫ້ເຫັນ** (ບັກງຽບ ຮ້າຍກວ່າໜ້າລົ້ມ).
 */
const FALLBACK_KIT_TYPES: readonly InstallKitType[] = [
  { install_type: "9900-0016", name_1: "ຕັ້ງແຕ່ 30,000 btu. ຂຶ້ນໄປ", ic_size: "121", sort_order: 50, active: true },
  { install_type: "9900-0017", name_1: "20,000-29,999 btu.", ic_size: "051", sort_order: 40, active: true },
  { install_type: "9900-0018", name_1: "15,000-19,999 btu.", ic_size: "033", sort_order: 30, active: true },
  { install_type: "9900-0019", name_1: "11,000-14,999 btu.", ic_size: "023", sort_order: 20, active: true },
  { install_type: "9900-0020", name_1: "8,000-10,999 btu.", ic_size: "112", sort_order: 10, active: true },
];

/** ທຸກໝວດ (ລວມທີ່ປິດແລ້ວ) ລຽງ BTU ໃຫຍ່ → ນ້ອຍ */
export async function listInstallKitTypes(): Promise<InstallKitType[]> {
  try {
    const rows = await query<InstallKitType & { active: boolean }>(
      `select install_type, coalesce(name_1,'') name_1, nullif(ic_size,'') ic_size,
          coalesce(sort_order,0)::int sort_order, (coalesce(active,1) = 1) as active
        from install_kit_type
       order by sort_order desc, install_type`,
    );
    // ຕາຕະລາງມີແຕ່ຫວ່າງ = ຄົນລົບໝົດເອງ ⇒ ນັບຖືການຕັດສິນໃຈນັ້ນ (ບໍ່ຕົກມາໃຊ້ fallback)
    return rows.rows;
  } catch (error) {
    /**
     * ຕົກມາໃຊ້ fallback **ສະເພາະ "ຕາຕະລາງບໍ່ມີ"** (Postgres 42P01 = undefined_table)
     * = ກໍລະນີຍັງບໍ່ໄດ້ແລ່ນ migration ເທົ່ານັ້ນ.
     *
     * ⚠️ ຢ່າກວມ error ອື່ນ (ຖານລົ້ມ · timeout · ສິດບໍ່ພໍ): ຖ້າກວມ ລະບົບຈະ**ຕອບຄ່າປອມ
     * ຢ່າງໝັ້ນໃຈ** ຕອນຖານມີບັນຫາ ⇒ ບິນຖືກຈັບໝວດຕາມ 5 ອັນເກົ່າ ທັງທີ່ຄວາມຈິງອາດຖືກແກ້ໄປແລ້ວ.
     * ປ່ອຍໃຫ້ throw ດີກວ່າ — ໜ້າລົ້ມດັງ ຄົນຮູ້ ແລະ ໄປແກ້ຖານ.
     */
    if ((error as { code?: string })?.code !== "42P01") throw error;
    console.error(
      "listInstallKitTypes: ຍັງບໍ່ມີຕາຕະລາງ install_kit_type — ຕົກມາໃຊ້ 5 ໝວດຕັ້ງຕົ້ນ. " +
        "ແລ່ນ migrations/2026-08-19-install-kit-types.sql ເພື່ອເປີດການຈັດການໝວດ",
    );
    return [...FALLBACK_KIT_TYPES];
  }
}

/** ໝວດດຽວ — ໃຊ້ກັນຄ່າຈາກຟອມ (ຢ່າເຊື່ອ browser) */
export async function findInstallKitType(code: string): Promise<InstallKitType | null> {
  if (!isSafeKitCode(code)) return null;
  const rows = await query<InstallKitType>(
    `select install_type, coalesce(name_1,'') name_1, nullif(ic_size,'') ic_size,
        coalesce(sort_order,0)::int sort_order, (coalesce(active,1) = 1) as active
      from install_kit_type where install_type = $1 limit 1`,
    [code],
  );
  return rows.rows[0] ?? null;
}

/**
 * `case ... end` ທີ່ແປງ item_size ຂອງ ERP ເປັນ install_type — ໃຊ້ຮ່ວມກັບ SQL ຂອງບິນ.
 *
 * ⚠️ **async ແລ້ວ** (ເມື່ອກ່ອນເປັນ const ທີ່ຄິດຈາກ array ໃນໂຄ້ດ): ຄູ່ ຂະໜາດ↔ຊຸດ
 * ມາຈາກຕາຕະລາງ ⇒ ຕ້ອງ await ກ່ອນປະກອບ SQL. ນັບແຕ່ **ໝວດທີ່ເປີດໃຊ້ ແລະ ຜູກ ic_size**.
 * ບໍ່ມີໝວດຈັກອັນ ⇒ ຄືນ `''` ໃຫ້ທຸກແຖວ (ພຶດຕິກຳດຽວກັບ else ເກົ່າ).
 */
export async function installTypeCaseSql(sizeExpr: string): Promise<string> {
  const types = (await listInstallKitTypes()).filter(
    (type) => type.active && type.ic_size && isSafeKitCode(type.ic_size) && isSafeKitCode(type.install_type),
  );
  if (!types.length) return `''`;
  const whens = types
    .map((type) => `when ${sizeExpr}='${type.ic_size}' then '${type.install_type}'`)
    .join(" ");
  return `case ${whens} else '' end`;
}

export type InstallKitLine = {
  roworder: number;
  line_number: number | null;
  ic_code: string;
  item_name: string;
  qty: number;
  unit_code: string | null;
  /**
   * ຫົວໜ່ວຍທີ່ສິນຄ້ານີ້ໃຊ້ໄດ້ (`ic_unit_use`) — ໃຫ້ຈໍເຮັດເປັນ dropdown.
   * ດຶງ **ເປັນກ້ອນດຽວ**ຢູ່ listInstallKits ບໍ່ແມ່ນຖາມທີລະແຖວຈາກ browser:
   * 5 ໝວດ × 13 ລາຍການ = 65 request ຕໍ່ການເປີດໜ້າ ⇒ ຊ້າ ແລະ ໜັກ ERP ບໍ່ມີເຫດຜົນ.
   * ຫວ່າງ = ERP ບໍ່ມີຂໍ້ມູນ/ລົ້ມ ⇒ ຈໍຕົກມາໃຊ້ຊ່ອງພິມ.
   */
  units: string[];
};

export type InstallKit = {
  code: string;
  /** ຊື່ໝວດທີ່ຕັ້ງເອງ (ໃນ install_kit_type) */
  name: string;
  ic_size: string | null;
  /** ຊື່ຂະໜາດຈາກ ERP (ic_size) — ບໍ່ມີ/ERP ລົ້ມ = null, ໃຫ້ຄົນກວດວ່າຜູກຖືກບໍ */
  size_name: string | null;
  active: boolean;
  sort_order: number;
  /** ຈຳນວນໃບງານທີ່ໃຊ້ຊຸດນີ້ຢູ່ — ບອກນ້ຳໜັກກ່ອນແກ້/ລົບ */
  jobs: number;
  lines: InstallKitLine[];
};

/** ທຸກຊຸດ + ລາຍການຂອງມັນ (ຊຸດຫວ່າງກໍ່ຄືນມານຳ) */
export async function listInstallKits(): Promise<InstallKit[]> {
  const types = await listInstallKitTypes();
  const codes = types.map((type) => type.install_type);
  const sizeCodes = types.map((type) => type.ic_size).filter((size): size is string => !!size);

  const [lines, jobs, sizes] = await Promise.all([
    query<Omit<InstallKitLine, "units"> & { install_type: string }>(
      `select install_type, roworder, line_number, coalesce(ic_code,'') ic_code,
          coalesce(name_1,'') item_name, coalesce(qty,0)::float8 qty, nullif(unit_code,'') unit_code
        from used_spare_install
       where install_type = any($1::varchar[])
       order by install_type, line_number, roworder`,
      [codes],
    ),
    query<{ install_type: string; n: number }>(
      `select install_type, count(*)::int n from ods_tb_install
        where install_type = any($1::varchar[]) group by install_type`,
      [codes],
    ),
    // ERP ລົ້ມ ⇒ ຢ່າໃຫ້ໜ້າຈັດການລົ້ມນຳ, ສະແດງລະຫັດຊຸດໄປກ່ອນ
    sizeCodes.length
      ? queryOdg<{ code: string; name_1: string }>(
          "select code, name_1 from ic_size where code = any($1::varchar[])",
          [sizeCodes],
        ).catch((error) => {
          console.error("listInstallKits: ic_size lookup failed", error);
          return { rows: [] as { code: string; name_1: string }[] };
        })
      : Promise.resolve({ rows: [] as { code: string; name_1: string }[] }),
  ]);

  const jobCount = new Map(jobs.rows.map((row) => [row.install_type, row.n]));
  const sizeName = new Map(sizes.rows.map((row) => [row.code, row.name_1]));
  // ຫົວໜ່ວຍຂອງທຸກລາຍການ **ຄັ້ງດຽວ** (ເບິ່ງເຫດຜົນຢູ່ InstallKitLine.units)
  const unitsByItem = await itemUnitsMap([...new Set(lines.rows.map((row) => row.ic_code))]);

  return types.map((type) => ({
    code: type.install_type,
    name: type.name_1,
    ic_size: type.ic_size,
    size_name: type.ic_size ? (sizeName.get(type.ic_size) ?? null) : null,
    active: type.active,
    sort_order: type.sort_order,
    jobs: jobCount.get(type.install_type) ?? 0,
    lines: lines.rows
      .filter((row) => row.install_type === type.install_type)
      .map((row) => ({ ...row, units: unitsByItem.get(row.ic_code) ?? [] })),
  }));
}

/**
 * ຫົວໜ່ວຍທີ່ໃຊ້ໄດ້ຂອງ **ຫຼາຍສິນຄ້າພ້ອມກັນ** — 1 query ບໍ່ແມ່ນ 1 ຕໍ່ລາຍການ.
 * ERP ລົ້ມ ⇒ ຄືນ map ຫວ່າງ (ຈໍຕົກມາໃຊ້ຊ່ອງພິມ) ບໍ່ໃຫ້ໜ້າຈັດການລົ້ມ.
 */
async function itemUnitsMap(itemCodes: string[]): Promise<Map<string, string[]>> {
  const codes = itemCodes.filter(Boolean);
  if (!codes.length) return new Map();
  try {
    const rows = await queryOdg<{ ic_code: string; code: string }>(
      `select u.ic_code, u.code
         from ic_unit_use u
        where u.ic_code = any($1::varchar[])
        order by u.ic_code, u.code`,
      [codes],
    );
    const map = new Map<string, string[]>();
    for (const row of rows.rows) {
      const list = map.get(row.ic_code) ?? [];
      if (row.code && !list.includes(row.code)) list.push(row.code);
      map.set(row.ic_code, list);
    }
    return map;
  } catch (error) {
    console.error("itemUnitsMap: ic_unit_use lookup failed", error);
    return new Map();
  }
}

/**
 * ຊື່ ແລະ ຫົວໜ່ວຍ **ຈາກ ERP** — ບໍ່ເຊື່ອຄ່າທີ່ຟອມສົ່ງມາ (ຮູບແບບດຽວກັບ addInstallSpare).
 * ຫົວໜ່ວຍຄືນເປັນ null ໄດ້: ຊຸດຕິດຕັ້ງມັກໃຊ້ຫົວໜ່ວຍຕ່າງຈາກຫົວໜ່ວຍຊື້ຂອງສິນຄ້າ
 * (ເບິ່ງ lib/install-standard) ⇒ ຄົນກຳນົດພິມທັບໄດ້.
 */
export async function erpItem(
  itemCode: string,
): Promise<{ code: string; name_1: string; unit_code: string | null } | null> {
  const rows = await queryOdg<{ code: string; name_1: string; unit_code: string | null }>(
    "select code, name_1, unit_standard as unit_code from ic_inventory where code=$1 limit 1",
    [itemCode],
  );
  return rows.rows[0] ?? null;
}

/**
 * ── ຫົວໜ່ວຍທີ່ສິນຄ້າໜຶ່ງ**ໃຊ້ໄດ້** (`ic_unit_use`) ──
 * ສິນຄ້າຫຼາຍຕົວມີຫຼາຍຫົວໜ່ວຍ (ນ໋ອດ: ເປົາ · ຕົວ · ກິໂລ) ແລະ ຊຸດຕິດຕັ້ງມັກໃຊ້
 * ຫົວໜ່ວຍ**ຍ່ອຍ** ຂະນະທີ່ `unit_standard` ເປັນຫົວໜ່ວຍຊື້ ⇒ ໃຫ້ຄົນເລືອກ ບໍ່ແມ່ນພິມມື
 * (ພິມມືແລ້ວຜິດ = ຈຳນວນຜິດຄວາມໝາຍ — ເບິ່ງ lib/install-standard).
 * ຄືນລວມ `unit_standard` ນຳສະເໝີ ເຜື່ອສິນຄ້ານັ້ນບໍ່ມີແຖວໃນ ic_unit_use.
 */
export async function erpItemUnits(itemCode: string): Promise<string[]> {
  const [used, item] = await Promise.all([
    queryOdg<{ code: string }>(
      "select code from ic_unit_use where ic_code = $1 order by code",
      [itemCode],
    ).catch((error) => {
      console.error("erpItemUnits: ic_unit_use lookup failed", error);
      return { rows: [] as { code: string }[] };
    }),
    erpItem(itemCode).catch(() => null),
  ]);
  const units = used.rows.map((row) => row.code).filter(Boolean);
  if (item?.unit_code && !units.includes(item.unit_code)) units.unshift(item.unit_code);
  return units;
}

/** ຄົ້ນຫາສິນຄ້າໃນ ERP ສຳລັບໜ້າຈັດການຊຸດ (ຕົວເລືອກຂອງ picker) */
export async function searchErpItems(
  keyword: string,
  limit = 20,
): Promise<{ code: string; name_1: string; unit_code: string | null }[]> {
  const q = keyword.trim();
  if (!q) return [];
  const rows = await queryOdg<{ code: string; name_1: string; unit_code: string | null }>(
    `select code, name_1, unit_standard as unit_code
       from ic_inventory
      where code ilike $1 or name_1 ilike $1
      order by code
      limit $2`,
    [`%${q}%`, limit],
  );
  return rows.rows;
}

/**
 * ຂະໜາດ (ic_size) ຂອງ ERP ໃຫ້ເລືອກຕອນສ້າງ/ແກ້ໝວດ.
 * ic_size ມີ ~489 ແຖວສຳລັບທຸກໝວດສິນຄ້າລວມກັນ (ເບິ່ງ actions/service-rate) ⇒ ສົ່ງທັງໝົດ
 * ໃຫ້ dropdown ທີ່ພິມຄົ້ນໄດ້ (components/select-field) ບໍ່ຕ້ອງມີ API ຄົ້ນຫາແຍກ.
 */
export async function listErpSizes(): Promise<{ code: string; name_1: string }[]> {
  try {
    const rows = await queryOdg<{ code: string; name_1: string }>(
      "select code, coalesce(name_1,'') name_1 from ic_size order by code",
    );
    return rows.rows;
  } catch (error) {
    console.error("listErpSizes failed", error);
    return [];
  }
}
