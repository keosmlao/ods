import { getSession } from "@/lib/auth";
import { ROLE_LABEL, roleOf } from "@/lib/roles";
import { ShieldOff } from "lucide-react";
import Link from "next/link";

/** ໜ້າ "ບໍ່ມີສິດເຂົ້າເຖິງ" — proxy ສົ່ງມາທີ່ນີ້ເມື່ອ role ບໍ່ມີສິດເປີດໜ້ານັ້ນ */
export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const role = ROLE_LABEL[roleOf(session)];

  return (
    <div className="mx-auto mt-10 grid max-w-md place-items-center gap-4 rounded-xl border border-slate-200 bg-white p-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-red-50 text-red-600">
        <ShieldOff className="size-7" />
      </span>
      <h1 className="text-lg font-bold text-slate-800">ບໍ່ມີສິດເຂົ້າເຖິງ</h1>
      <p className="text-sm text-slate-500">
        ສິດຂອງທ່ານ ({role}) ບໍ່ສາມາດເປີດໜ້ານີ້ໄດ້. ຖ້າຕ້ອງການສິດເພີ່ມ ກະລຸນາຕິດຕໍ່ຜູ້ຈັດການ.
      </p>
      {params.from && <p className="break-all text-xs text-slate-400">{params.from}</p>}
      <Link
        href="/dashboard"
        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
      >
        ກັບໄປໜ້າຫຼັກ
      </Link>
    </div>
  );
}
