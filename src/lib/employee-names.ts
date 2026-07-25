import { queryOdg } from "@/lib/db";
import { ERP_IDENTITY_SQL } from "@/lib/erp-auth";

/**
 * **ແປລະຫັດພະນັກງານ → ຊື່** ຈາກ `odg_employee` (ERP).
 *
 * ── ບັນຫາ ──
 * ຖັນ emp_code / user_regis ຢູ່ tb_product ເກັບ **ບໍ່ຄົງທີ່**: ບາງໃບເປັນຕົວຕົນ (ຊື່ຫຼິ້ນ
 * ເຊັ່ນ "ພວງ") ບາງໃບເປັນ **ລະຫັດພະນັກງານ** (ເຊັ່ນ "22020"). ໜ້າຈໍຈຶ່ງໂຊ້ລະຫັດປົນຊື່.
 *
 * ── ວິທີແກ້ ──
 * ໃຫ້ map: ຄ່າທີ່ **ກົງກັບ employee_code** → ຕົວຕົນ ERP (ຊື່ຫຼິ້ນ/ຊື່ເຕັມ ຄືກັບຕອນ login).
 * ຄ່າທີ່ບໍ່ກົງ (ເປັນຊື່ຢູ່ແລ້ວ ຫຼື username ເກົ່າ) → ຄົງໄວ້ຕາມເດີມ.
 *
 * odg_employee ຢູ່ **ERP pool** (queryOdg) — ຂ້າມ pool ບໍ່ໄດ້ ⇒ ດຶງ map ແລ້ວແປໃນ JS.
 */
export async function employeeNameMap(codes: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniq = [...new Set(codes.map((c) => (c ?? "").trim()).filter(Boolean))];
  if (uniq.length === 0) return new Map();
  try {
    const rows = (
      await queryOdg<{ employee_code: string; identity: string }>(
        `select employee_code, ${ERP_IDENTITY_SQL} as identity
           from odg_employee e where e.employee_code = any($1)`,
        [uniq],
      )
    ).rows;
    return new Map(rows.map((r) => [r.employee_code, (r.identity ?? "").trim() || r.employee_code]));
  } catch (error) {
    // ERP ຂັດຂ້ອງ → ໂຊ້ຄ່າເດີມ (ບໍ່ພັງໜ້າ)
    console.error("employeeNameMap failed", error);
    return new Map();
  }
}

/** ແປຄ່າໜຶ່ງ — ກົງກັບລະຫັດ = ຊື່, ບໍ່ກົງ = ຄ່າເດີມ (ຫວ່າງ = "-") */
export function resolveName(value: string | null | undefined, map: Map<string, string>): string {
  const text = (value ?? "").trim();
  if (!text) return "-";
  return map.get(text) ?? text;
}
