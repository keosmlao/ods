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
 */

/** ຊື່ເມນູ — ຕ້ອງຕົງກັບ PERMISSION_RESOURCES (lib/permission-catalog) */
export const INSTALL_KIT_MENU = "/manage/install-kits";

/**
 * ── install_type ↔ ຂະໜາດ (ic_size) ຂອງ ERP ──
 * ຄູ່ນີ້ **ຝັງຢູ່ໃນລະບົບ** (ບໍ່ມີຕາຕະລາງ master ໃນຖານ): ຕອນອ່ານບິນ ລະບົບແປງ
 * `ic_inventory.item_size` → `sv_type` → `ods_tb_install.install_type`.
 * ເກັບໄວ້ບ່ອນດຽວຢູ່ນີ້ ແລ້ວ api/installations/bills ໃຊ້ຕໍ່ ⇒ ບໍ່ມີສອງບ່ອນຄິດບໍ່ຕົງກັນ.
 */
export const INSTALL_KIT_TYPES = [
  { code: "9900-0016", size: "121" },
  { code: "9900-0017", size: "051" },
  { code: "9900-0018", size: "033" },
  { code: "9900-0019", size: "023" },
  { code: "9900-0020", size: "112" },
] as const;

export type InstallKitType = (typeof INSTALL_KIT_TYPES)[number]["code"];

/** ລະຫັດຊຸດທີ່ຖືກຕ້ອງບໍ — ໃຊ້ກັນຄ່າຈາກຟອມ (ຢ່າເຊື່ອ browser) */
export function isInstallKitType(value: string): value is InstallKitType {
  return INSTALL_KIT_TYPES.some((type) => type.code === value);
}

/** `case ... end` ທີ່ແປງ item_size ຂອງ ERP ເປັນ install_type — ໃຊ້ຮ່ວມກັບ SQL ຂອງບິນ */
export const installTypeFromSizeSql = (sizeExpr: string) =>
  `case ${INSTALL_KIT_TYPES.map((type) => `when ${sizeExpr}='${type.size}' then '${type.code}'`).join(" ")} else '' end`;

export type InstallKitLine = {
  roworder: number;
  line_number: number | null;
  ic_code: string;
  item_name: string;
  qty: number;
  unit_code: string | null;
};

export type InstallKit = {
  code: string;
  /** ຊື່ຂະໜາດຈາກ ERP (ic_size) — ບໍ່ມີ/ERP ລົ້ມ = null, ຈໍສະແດງແຕ່ລະຫັດ */
  size_name: string | null;
  /** ຈຳນວນໃບງານທີ່ໃຊ້ຊຸດນີ້ຢູ່ — ບອກນ້ຳໜັກກ່ອນແກ້ */
  jobs: number;
  lines: InstallKitLine[];
};

/** ທຸກຊຸດ + ລາຍການຂອງມັນ (ຊຸດຫວ່າງກໍ່ຄືນມານຳ) */
export async function listInstallKits(): Promise<InstallKit[]> {
  const codes = INSTALL_KIT_TYPES.map((type) => type.code);

  const [lines, jobs, sizes] = await Promise.all([
    query<InstallKitLine & { install_type: string }>(
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
    queryOdg<{ code: string; name_1: string }>(
      "select code, name_1 from ic_size where code = any($1::varchar[])",
      [INSTALL_KIT_TYPES.map((type) => type.size)],
    ).catch((error) => {
      console.error("listInstallKits: ic_size lookup failed", error);
      return { rows: [] as { code: string; name_1: string }[] };
    }),
  ]);

  const jobCount = new Map(jobs.rows.map((row) => [row.install_type, row.n]));
  const sizeName = new Map(sizes.rows.map((row) => [row.code, row.name_1]));

  return INSTALL_KIT_TYPES.map((type) => ({
    code: type.code,
    size_name: sizeName.get(type.size) ?? null,
    jobs: jobCount.get(type.code) ?? 0,
    lines: lines.rows.filter((row) => row.install_type === type.code),
  }));
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
