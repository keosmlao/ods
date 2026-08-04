import { getSession } from "@/lib/auth";
import { homeForRole, ROLE_LABEL, roleOf } from "@/lib/roles";
import { ShieldOff } from "lucide-react";
import Link from "next/link";

/** ໜ້າ "ບໍ່ມີສິດເຂົ້າເຖິງ" — proxy ສົ່ງມາທີ່ນີ້ເມື່ອ role ບໍ່ມີສິດເປີດໜ້ານັ້ນ */
export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const userRole = roleOf(session);
  const role = ROLE_LABEL[userRole];
  /**
   * ⚠️ ປຸ່ມນີ້ເຄີຍຕັ້ງ `/dashboard` ຕາຍຕົວ — ແຕ່ **ຊ່າງບໍ່ມີສິດ /dashboard**
   * (roles.ts: EVERYONE ຍົກເວັ້ນ T) ⇒ ກົດແລ້ວກັບມາໜ້ານີ້ອີກ = ຕິດວົງວຽນ ອອກບໍ່ໄດ້.
   * ໃຊ້ homeForRole ຄືກັບ login/logo ⇒ ໜ້າຫຼັກຂອງແຕ່ລະ role ທີ່ເປີດໄດ້ຈິງ.
   */
  const home = homeForRole(userRole);

  return (
    <div className="mx-auto mt-10 grid max-w-md place-items-center gap-4 rounded-xl border border-slate-200 bg-white p-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand-orange-50 text-brand-orange-700">
        <ShieldOff className="size-7" />
      </span>
      <h1 className="text-lg font-bold text-slate-800">ບໍ່ມີສິດເຂົ້າເຖິງ</h1>
      <p className="text-sm text-slate-500">
        ສິດຂອງທ່ານ ({role}) ບໍ່ສາມາດເປີດໜ້ານີ້ໄດ້. ຖ້າຕ້ອງການສິດເພີ່ມ ກະລຸນາຕິດຕໍ່ຜູ້ຈັດການ.
      </p>
      {params.from && <p className="break-all text-xs text-slate-400">{params.from}</p>}
      <Link
        href={home}
        className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
      >
        ກັບໄປໜ້າຫຼັກ
      </Link>
    </div>
  );
}
