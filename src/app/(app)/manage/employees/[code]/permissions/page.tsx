import { PERMISSION_RESOURCES, type CrudPermission, type PermissionAction } from "@/lib/permission-catalog";
import { employeePermissionOverrides, employeePermissionProfile } from "@/lib/permissions";
import { canAccess, ROLE_LABEL } from "@/lib/roles";
import { ArrowLeft, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionMatrix, type PermissionMatrixRow } from "./permission-matrix";

function inherited(profileRole: Parameters<typeof canAccess>[0], resource: string, actions: readonly PermissionAction[]): CrudPermission {
  const read = canAccess(profileRole, resource);
  const supported = new Set(actions);
  return {
    read,
    create: read && supported.has("create"),
    update: read && supported.has("update"),
    delete: read && supported.has("delete"),
  };
}

export default async function EmployeePermissionsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const employeeCode = decodeURIComponent(code);
  const [profile, overrides] = await Promise.all([
    employeePermissionProfile(employeeCode),
    employeePermissionOverrides(employeeCode),
  ]);
  if (!profile) notFound();

  const rows: PermissionMatrixRow[] = PERMISSION_RESOURCES.filter((item) => !item.protected).map((item) => {
    const actions = [...(item.actions ?? ["read", "create", "update", "delete"])] as PermissionAction[];
    const assigned = overrides.get(item.resource);
    return {
      group: item.group,
      label: item.label,
      resource: item.resource,
      actions,
      inherit: !assigned,
      permission: assigned ?? inherited(profile.role, item.resource, actions),
    };
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/manage/employees" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
            <ArrowLeft className="size-3.5" /> ກັບໄປລາຍການພະນັກງານ
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <ShieldCheck className="size-5 text-teal-600" /> ກຳນົດສິດລາຍຜູ້ໃຊ້
          </h1>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
            <UserRound className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-800">{profile.identity}</span>
            <span className="block text-xs text-slate-500">
              {profile.employeeCode} · {profile.fullname} · {ROLE_LABEL[profile.role]}
            </span>
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
        ສິດ “ອ່ານ” ຄວບຄຸມການເຫັນເມນູ ແລະເຂົ້າໜ້າ. ສິດ “ສ້າງ / ແກ້ໄຂ / ລົບ”
        ຖືກກວດຊ້ຳຝັ່ງ server. ການຕັ້ງເປັນ “ຕາມ role” ຈະປັບຕາມ role ໃໝ່ໃນອະນາຄົດອັດຕະໂນມັດ.
      </div>

      <PermissionMatrix employeeCode={profile.employeeCode} initialRows={rows} />
    </div>
  );
}
