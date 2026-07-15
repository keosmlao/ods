import "server-only";
import type { Session } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * ເຂດຮັບຜິດຊອບຂອງພະນັກງານຂາຍ (ods_sales_zone) — ນິຍາມດ້ວຍ ແຂວງ/ເມືອງ.
 *
 * session.username ເປັນ **ຕົວຕົນ** (ຊື່ຫຼິ້ນ ERP) ບໍ່ແມ່ນ employee_code ໂດຍກົງ ⇒ ຕ້ອງ
 * ແປງຜ່ານ mapping ຄືກັບ permissionOverrides() ຂອງ lib/permissions (ods_user_employee /
 * ods_employee_role) ບໍ່ດັ່ງນັ້ນ zone ຈະຫວ່າງທັງທີ່ຜູ້ຈັດການມອບແລ້ວ.
 */

export type Zone = { provine: string; city: string | null; province_name: string | null; city_name: string | null };

function missingTable(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "42P01";
}

/** ເຂດທັງໝົດຂອງພະນັກງານທີ່ login — [] ຖ້າຍັງບໍ່ໄດ້ຮັບມອບເຂດ */
export async function salesZonesFor(session: Session): Promise<Zone[]> {
  try {
    const rows = (
      await query<Zone>(
        `select distinct z.provine, nullif(z.city,'') as city,
                p.name_1 as province_name, c.name_1 as city_name
           from ods_sales_zone z
           left join province p on p.code = z.provine
           left join city c on c.code = z.city and c.province = z.provine
          where lower(z.employee_code) = lower($1)
             or z.employee_code in (
                  select employee_code from ods_user_employee
                   where lower(user_code) = lower($1) or lower(employee_code) = lower($1)
                )
             or z.employee_code in (
                  select employee_code from ods_employee_role
                   where lower(identity) = lower($1) or lower(employee_code) = lower($1)
                )
          order by z.provine, city nulls first`,
        [session.username],
      )
    ).rows;
    return rows;
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

/**
 * SQL predicate ກອງ ar_customer (alias `b`) ໃຫ້ຢູ່ໃນເຂດ — ໃສ່ຕໍ່ຈາກ param ທີ່ offset.
 * ບໍ່ມີເຂດ ⇒ `false` (ເຫັນສູນລາຍການ — ບໍ່ແມ່ນເຫັນໝົດ).
 * city = null ⇒ ຮັບຜິດຊອບທັງແຂວງ.
 */
export function zoneWhere(zones: Zone[], alias: string, offset: number): { sql: string; params: string[] } {
  if (!zones.length) return { sql: "false", params: [] };
  const params: string[] = [];
  const parts = zones.map((zone) => {
    params.push(zone.provine);
    const province = `${alias}.provine = $${offset + params.length}`;
    if (zone.city) {
      params.push(zone.city);
      return `(${province} and ${alias}.city = $${offset + params.length})`;
    }
    return `(${province})`;
  });
  return { sql: `(${parts.join(" or ")})`, params };
}
