import { PageTitle } from "@/components/ui";
import { requireRoleOrRedirect } from "@/lib/guard";
import { recentLogins } from "@/lib/login-log";
import { Smartphone, Monitor } from "lucide-react";

/** ຕິດຕາມການເຂົ້າລະບົບ (ຜູ້ຈັດການ) — ໃຜເຂົ້າ ເມື່ອໃດ ຈາກເວັບ/ມືຖື ແລະ IP ໃດ. */
export default async function LoginLogPage() {
  await requireRoleOrRedirect(["manager"]);
  const rows = await recentLogins(300);

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <PageTitle sub={`ປະຫວັດການ login ${rows.length} ຄັ້ງຫຼ້າສຸດ (ເວັບ + ມືຖື)`}>ຕິດຕາມການເຂົ້າລະບົບ</PageTitle>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">ຍັງບໍ່ມີບັນທຶກການເຂົ້າລະບົບ</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full min-w-[640px] border-collapse bg-white text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-bold">ຜູ້ໃຊ້</th>
                <th className="px-4 py-3 font-bold">ຊ່ອງທາງ</th>
                <th className="px-4 py-3 font-bold">ເວລາ</th>
                <th className="px-4 py-3 font-bold">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const mobile = row.source === "mobile";
                return (
                  <tr key={i} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-slate-700">{row.username}</span>
                      {row.emp_code && <span className="ml-2 font-mono text-[11px] text-slate-400">{row.emp_code}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          mobile ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"
                        }`}
                        title={row.user_agent ?? ""}
                      >
                        {mobile ? <Smartphone className="size-3.5" /> : <Monitor className="size-3.5" />}
                        {mobile ? "ມືຖື" : "ເວັບ"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">{row.logged_at}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-slate-500">{row.ip ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
