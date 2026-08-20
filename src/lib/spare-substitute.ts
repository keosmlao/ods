import "server-only";

import { query, queryOdg } from "@/lib/db";

/**
 * ── ກຸ່ມອາໄຫຼ່ທົດແທນກັນ (`spare_sub_group` / `spare_sub_item`) ──
 *
 * ຊຸດມາດຕະຖານລະບຸລະຫັດຕົວດຽວຕໍ່ລາຍການ ແຕ່ໜ້າງານໃຊ້ຍີ່ຫໍ້ໃດກໍ່ໄດ້ຖ້າ spec ຄືກັນ
 * (ທໍ່ PVC ສີເຫຼືອງ 3/8 ມີ 4 ລະຫັດ ຕ່າງແຕ່ຍີ່ຫໍ້) ⇒ ຕາຕະລາງນີ້ບອກວ່າ "ຫຍັງແທນ X ໄດ້".
 *
 * **ກຸ່ມສາກົນ** (ບໍ່ແມ່ນຕໍ່ໝວດ) ແລະ **1 ສິນຄ້າ = 1 ກຸ່ມ** — ເບິ່ງເຫດຜົນຢູ່
 * migrations/2026-08-20-spare-substitute.sql
 */

export type SubstituteMember = {
  ic_code: string;
  /** ຊື່ຈາກ ERP — null = ERP ລົ້ມ/ບໍ່ພົບ (ຈໍສະແດງແຕ່ລະຫັດ) */
  name_1: string | null;
  unit_code: string | null;
};

export type SubstituteGroup = {
  group_id: number;
  name_1: string;
  items: SubstituteMember[];
};

/** ຊື່/ຫົວໜ່ວຍຈາກ ERP ຂອງຫຼາຍລະຫັດພ້ອມກັນ — ERP ລົ້ມ ⇒ map ຫວ່າງ */
async function erpNames(
  codes: string[],
): Promise<Map<string, { name_1: string; unit_code: string | null }>> {
  if (!codes.length) return new Map();
  try {
    const rows = await queryOdg<{ code: string; name_1: string; unit_code: string | null }>(
      `select code, coalesce(name_1,'') name_1, unit_standard as unit_code
         from ic_inventory where code = any($1::varchar[])`,
      [codes],
    );
    return new Map(rows.rows.map((row) => [row.code, { name_1: row.name_1, unit_code: row.unit_code }]));
  } catch (error) {
    console.error("erpNames lookup failed", error);
    return new Map();
  }
}

/** ທຸກກຸ່ມ + ສະມາຊິກ (ສຳລັບໜ້າຈັດການ) */
export async function listSubstituteGroups(): Promise<SubstituteGroup[]> {
  const rows = await query<{ group_id: number; name_1: string; ic_code: string | null }>(
    `select g.group_id, coalesce(g.name_1,'') name_1, i.ic_code
       from spare_sub_group g
       left join spare_sub_item i on i.group_id = g.group_id
      order by g.group_id, i.ic_code`,
  );
  const names = await erpNames([
    ...new Set(rows.rows.map((row) => row.ic_code).filter((code): code is string => !!code)),
  ]);

  const groups = new Map<number, SubstituteGroup>();
  for (const row of rows.rows) {
    let group = groups.get(row.group_id);
    if (!group) {
      group = { group_id: row.group_id, name_1: row.name_1, items: [] };
      groups.set(row.group_id, group);
    }
    // left join ⇒ ກຸ່ມຫວ່າງມີແຖວດຽວທີ່ ic_code ເປັນ null
    if (row.ic_code) {
      const erp = names.get(row.ic_code);
      group.items.push({
        ic_code: row.ic_code,
        name_1: erp?.name_1 ?? null,
        unit_code: erp?.unit_code ?? null,
      });
    }
  }
  return [...groups.values()];
}

/**
 * ── "ຫຍັງແທນ X ໄດ້" ສຳລັບຫຼາຍ X ພ້ອມກັນ ──
 *
 * ຄືນ **ສະມາຊິກອື່ນ**ໃນກຸ່ມດຽວກັນ (ບໍ່ລວມຕົວມັນເອງ). 1 query ບໍ່ແມ່ນ 1 ຕໍ່ລາຍການ
 * — ໜ້າໃບງານຖາມພ້ອມກັນ 13+ ລາຍການ.
 *
 * ⚠️ ERP ລົ້ມ ⇒ ຊື່ເປັນ null ແຕ່ **ຍັງຄືນລະຫັດ** (ເລືອກໄດ້ຢູ່ ພຽງແຕ່ຈໍສະແດງລະຫັດ)
 * — ບໍ່ຄວນເຮັດໃຫ້ຄວາມສາມາດຫາຍໄປພຽງເພາະຊື່ອ່ານບໍ່ໄດ້.
 */
export async function substitutesFor(
  itemCodes: string[],
): Promise<Map<string, SubstituteMember[]>> {
  const codes = [...new Set(itemCodes.filter(Boolean))];
  if (!codes.length) return new Map();

  let rows: { source: string; ic_code: string }[];
  try {
    rows = (
      await query<{ source: string; ic_code: string }>(
        `select mine.ic_code as source, other.ic_code
           from spare_sub_item mine
           join spare_sub_item other
             on other.group_id = mine.group_id and other.ic_code <> mine.ic_code
          where mine.ic_code = any($1::varchar[])
          order by other.ic_code`,
        [codes],
      )
    ).rows;
  } catch (error) {
    // ຕາຕະລາງຍັງບໍ່ມີ (ຍັງບໍ່ແລ່ນ migration) ⇒ ບໍ່ມີຕົວທົດແທນ ບໍ່ແມ່ນໜ້າລົ້ມ
    console.error("substitutesFor failed", error);
    return new Map();
  }
  if (!rows.length) return new Map();

  const names = await erpNames([...new Set(rows.map((row) => row.ic_code))]);
  const map = new Map<string, SubstituteMember[]>();
  for (const row of rows) {
    const erp = names.get(row.ic_code);
    const list = map.get(row.source) ?? [];
    list.push({
      ic_code: row.ic_code,
      name_1: erp?.name_1 ?? null,
      unit_code: erp?.unit_code ?? null,
    });
    map.set(row.source, list);
  }
  return map;
}

/**
 * ລະຫັດທັງໝົດທີ່ "ທຽບເທົ່າ" ກັບຊຸດທີ່ໃຫ້ມາ (ລວມຕົວມັນເອງ) — ໃຊ້ເປັນ**ດ່ານ**:
 * ຕົວທົດແທນຂອງລາຍການໃນຊຸດ ນັບເປັນ "ຕາມມາດຕະຖານ" ນຳ (ເບິ່ງ lib/install-standard).
 */
export async function equivalentCodes(itemCodes: string[]): Promise<Set<string>> {
  const codes = [...new Set(itemCodes.filter(Boolean))];
  const all = new Set(codes);
  if (!codes.length) return all;
  try {
    const rows = await query<{ ic_code: string }>(
      `select distinct other.ic_code
         from spare_sub_item mine
         join spare_sub_item other on other.group_id = mine.group_id
        where mine.ic_code = any($1::varchar[])`,
      [codes],
    );
    for (const row of rows.rows) all.add(row.ic_code);
  } catch (error) {
    console.error("equivalentCodes failed", error);
  }
  return all;
}
