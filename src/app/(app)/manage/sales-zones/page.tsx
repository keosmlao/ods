import { PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { requireRoleOrRedirect } from "@/lib/guard";
import { MapPin } from "lucide-react";
import { AddZoneForm, RemoveZoneButton } from "./sales-zone-controls";

/**
 * ຈັດການເຂດຮັບຜິດຊອບຂອງພະນັກງານຂາຍ — ຜູ້ຈັດການເທົ່ານັ້ນ.
 * ພະນັກງານຂາຍ = ຄົນທີ່ຖືກມອບ role 'sales' ຢູ່ /manage/employees (ods_employee_role.app_role).
 */
export const dynamic = "force-dynamic";

type Zone = {
  employee_code: string;
  provine: string;
  city: string | null;
  province_name: string | null;
  city_name: string | null;
};

export default async function SalesZonesPage() {
  await requireRoleOrRedirect(["manager"]);

  const [staff, zones, provinces, cities] = await Promise.all([
    query<{ employee_code: string; identity: string }>(
      "select employee_code, identity from ods_employee_role where app_role = 'sales' order by identity",
    ),
    query<Zone>(
      `select z.employee_code, z.provine, nullif(z.city,'') city,
         p.name_1 province_name, c.name_1 city_name
       from ods_sales_zone z
       left join province p on p.code = z.provine
       left join city c on c.code = z.city and c.province = z.provine
       order by p.name_1, c.name_1`,
    ),
    query<{ code: string; name_1: string }>("select code, name_1 from province order by roworder asc"),
    query<{ code: string; name_1: string; province: string }>(
      "select code, name_1, province from city order by roworder asc",
    ),
  ]);

  const byEmployee = new Map<string, Zone[]>();
  for (const zone of zones.rows) {
    const list = byEmployee.get(zone.employee_code) ?? [];
    list.push(zone);
    byEmployee.set(zone.employee_code, list);
  }

  const employees = staff.rows.map((s) => ({ code: s.employee_code, name_1: s.identity || s.employee_code }));

  return (
    <div className="w-full space-y-5">
      <PageTitle sub="ພະນັກງານຂາຍເຫັນສະເພາະງານສ້ອມຂອງລູກຄ້າໃນເຂດທີ່ຮັບຜິດຊອບ">ຈັດການເຂດຂາຍ</PageTitle>

      {employees.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          ຍັງບໍ່ມີພະນັກງານໃດຖືກມອບສິດ “ພະນັກງານຂາຍ” — ໄປມອບ role ໃຫ້ກ່ອນທີ່ໜ້າ “ກຳນົດສິດ” (/manage/employees).
        </p>
      ) : (
        <>
          <AddZoneForm employees={employees} provinces={provinces.rows} cities={cities.rows} />

          <div className="space-y-3">
            {staff.rows.map((person) => {
              const list = byEmployee.get(person.employee_code) ?? [];
              return (
                <div key={person.employee_code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-semibold text-slate-700">{person.identity || person.employee_code}</span>
                    <span className="text-xs text-slate-400">#{person.employee_code}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-xs text-slate-400">ຍັງບໍ່ໄດ້ກຳນົດເຂດ</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {list.map((zone) => (
                        <span
                          key={`${zone.provine}-${zone.city ?? ""}`}
                          className="inline-flex items-center gap-1 rounded-full bg-teal-50 py-1 pl-2.5 pr-1 text-xs text-teal-700"
                        >
                          <MapPin className="size-3" />
                          {zone.city_name
                            ? `${zone.city_name}, ${zone.province_name ?? zone.provine}`
                            : `ທັງແຂວງ ${zone.province_name ?? zone.provine}`}
                          <RemoveZoneButton employeeCode={zone.employee_code} provine={zone.provine} city={zone.city ?? ""} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
