import { getSession } from "@/lib/auth";
import { CLAIM_FLOW, CLAIM_TYPE_LABEL, claimCounts, isClaimOpen, listClaims, type ClaimType } from "@/lib/claim";
import { CLAIM_SIDE, roleOf } from "@/lib/roles";
import { FilePlus2, ReceiptText, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * ລະບົບເຄມ — ລາຍการ + ແຍກ tab ຕາมประเภท (A supplier / B ຮ້ານ / C ເກັບເງิน) + status.
 */
export const dynamic = "force-dynamic";

const TYPES: ClaimType[] = ["A", "B", "C"];
const isType = (v: string): v is ClaimType => TYPES.includes(v as ClaimType);

type Props = { searchParams: Promise<{ type?: string; status?: string; q?: string }> };

export default async function ClaimsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!CLAIM_SIDE.includes(roleOf(session))) redirect("/forbidden");

  const sp = await searchParams;
  const type: ClaimType = isType(sp.type ?? "") ? (sp.type as ClaimType) : "A";
  const status = sp.status?.trim() || "";
  const q = sp.q?.trim() || "";

  const [rows, counts] = await Promise.all([
    listClaims({ type, status: status || undefined, q: q || undefined }),
    claimCounts(type),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const link = (t: ClaimType, s?: string) =>
    `/claims?${new URLSearchParams({ type: t, ...(s ? { status: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-700">
          <ReceiptText className="size-5 text-teal-600" />
          ລະບົບເຄມ (Claim)
        </h1>
        <Link href={`/claims/new?type=${type}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700">
          <FilePlus2 className="size-4" /> ເປີດໃບເຄມ
        </Link>
      </div>

      {/* ── tab ປະເພດ ── */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {TYPES.map((t) => (
          <Link
            key={t}
            href={link(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${t === type ? "bg-slate-900 text-white shadow-sm" : "bg-white text-slate-500 hover:bg-slate-100"}`}
          >
            <span className="font-mono">CLM-{t}</span> · {CLAIM_TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      {/* ── status chips ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={link(type)} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${!status ? "bg-teal-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
          ທັງໝົດ <span className="tabular-nums opacity-80">{total}</span>
        </Link>
        {CLAIM_FLOW[type].map((s) => (
          <Link key={s.status} href={link(type, s.status)} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${status === s.status ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {s.label} <span className="tabular-nums opacity-80">{counts[s.status] ?? 0}</span>
          </Link>
        ))}
      </div>

      <form action="/claims" method="get" className="flex gap-2">
        <input type="hidden" name="type" value={type} />
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="ຄົ້ນ ເລກເຄມ · supplier · ເລກงาน · ຮ້าน" className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-teal-500" />
        </div>
        <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white">ຄົ້ນ</button>
      </form>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">ຍັງບໍ່ມີໃບເຄມ</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[820px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">ເລກເຄມ</th>
                <th className="px-3 py-2 font-semibold">ສະຖານະ</th>
                <th className="px-3 py-2 font-semibold">Supplier / ຮ້ານ</th>
                <th className="px-3 py-2 font-semibold">ຫຍີ່ຫໍ້</th>
                <th className="px-3 py-2 font-semibold">ເລກງານ</th>
                <th className="px-3 py-2 text-right font-semibold">ຍອດ</th>
                <th className="px-3 py-2 font-semibold">ເປີດ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.claim_no} className={`border-b border-slate-100 hover:bg-slate-50 ${isClaimOpen(r.status) ? "" : "bg-slate-50/60"}`}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-[#0536a9]">
                    <Link href={`/claims/${r.claim_no}`} className="hover:underline">{r.claim_no}</Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${isClaimOpen(r.status) ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>{r.status_label}</span>
                  </td>
                  <td className="px-3 py-2">{r.customer_name || r.supplier_code || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.brand_code || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.ref_job || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.amount ? r.amount.toLocaleString() : "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.created_at || "-"}{r.created_by ? ` · ${r.created_by}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
