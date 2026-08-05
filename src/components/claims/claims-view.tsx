import {
  CLAIM_FLOW,
  CLAIM_PAGES,
  CLAIM_SCOPE_LABEL,
  CLAIM_TYPE_LABEL,
  claimAmountSummary,
  claimCandidatesC,
  claimCounts,
  claimScopeSummary,
  isClaimOpen,
  listClaims,
  type ClaimType,
} from "@/lib/claim";
import { ClaimRowActions } from "@/components/claims/claim-row-actions";
import { Download, FilePlus2, Search } from "lucide-react";
import Link from "next/link";

/**
 * ໜ້າລາຍການເຄມ **ຂອງ 1 ປະເພດ** (ໃຊ້ຮ່ວມ 3 route: /claims/shop·supplier·reimburse).
 * ⚠️ ບໍ່ມີ type-tab — ແຕ່ລະ route = 1 type. ໃຊ້ pill ຂ້າມໄປ 3 ໜ້າແທນ (CLAIM_PAGES).
 *
 * ອອກແບບໃໝ່ 05-08-2026: ບັດ KPI ທຸກ type (A: ຍອດຄ້າງ/ລໍ supplier/ອະນຸມັດ/ອາຍຸຄ້າງ ·
 * B: ຂອບເຂດ/ວິທີຈັດການ · C: ແຈ້ງ/ລໍຊຳລະ/ເກັບແລ້ວ), pill ນຳທາງ 3 ໜ້າເຄມ,
 * chip ສະຖານະ + ປ້າຍສີຕາມຂັ້ນ. ຕົວເລກ KPI ມາຈາກ claimAmountSummary (ບໍ່ຫົດຕາມ filter).
 */

/** ສີປ້າຍຕາມ status — ໃຊ້ຮ່ວມທຸກ type (status ທີ່ບໍ່ມີ ໃຊ້ສີເທົາ) */
const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-amber-100 text-amber-800",
  review: "bg-violet-50 text-violet-700",
  approved: "bg-teal-50 text-teal-700",
  received: "bg-emerald-50 text-emerald-700",
  checking: "bg-violet-50 text-violet-700",
  done: "bg-teal-50 text-teal-700",
  returned: "bg-emerald-50 text-emerald-700",
  notify: "bg-slate-100 text-slate-600",
  notified: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
  rejected: "bg-red-50 text-red-700",
};
const tone = (status: string) => STATUS_TONE[status] ?? "bg-slate-100 text-slate-600";

export async function ClaimsView({
  type,
  basePath,
  status,
  q,
}: {
  type: ClaimType;
  basePath: string;
  status: string;
  q: string;
}) {
  const [rows, counts, summary, candidates, scopeSummary] = await Promise.all([
    listClaims({ type, status: status || undefined, q: q || undefined }),
    claimCounts(type),
    claimAmountSummary(type),
    type === "C" ? claimCandidatesC() : Promise.resolve([]),
    type === "B" ? claimScopeSummary(type) : Promise.resolve<{ scope: Record<string, number>; fulfillment: Record<string, number> }>({ scope: {}, fulfillment: {} }),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  // 'paid' (C) = ປິດແລ້ວ ຄືກັນ — flow C ຈົບທີ່ paid, ບໍ່ມີ closed
  const closedN = (counts.closed ?? 0) + (counts.rejected ?? 0) + (counts.paid ?? 0);
  const openN = total - closedN;
  const money = (value: number) => Math.round(value).toLocaleString();
  const exportHref = `/api/reports/export/claims?${new URLSearchParams({ type, ...(status ? { status } : {}), ...(q ? { q } : {}) })}`;
  const link = (s?: string) => `${basePath}?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <div className="w-full space-y-4">
      {/* ── ຫົວ + pill ນຳທາງ 3 ໜ້າເຄມ ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">
            <span className="font-mono text-brand-800">CLM-{type}</span> · {CLAIM_TYPE_LABEL[type]}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {openN} ໃບເປີດຢູ່ · {closedN} ປິດ/ปฏิเสธແລ້ວ · ທັງໝົດ {total} ໃບ
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {total > 0 && (
            <a href={exportHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-800 hover:bg-brand-100">
              <Download className="size-4" /> ດຶງ Excel
            </a>
          )}
          <Link href={type === "B" ? "/service/new?kind=claim" : `/claims/new?type=${type}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800">
            <FilePlus2 className="size-4" /> {type === "B" ? "ຮັບເຄື່ອງເຄມ" : "ເປີດໃບເຄມ"}
          </Link>
        </div>
      </div>

      <nav className="flex w-fit flex-wrap gap-1 rounded-xl border border-slate-300 p-1">
        {CLAIM_PAGES.map((page) => (
          <Link
            key={page.type}
            href={page.path}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              page.type === type ? "bg-brand-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            CLM-{page.type} · {page.short}
          </Link>
        ))}
      </nav>

      {/* ── ບັດ KPI (ຍອດລວມທັງ type — ບໍ່ຫົດຕາມ filter/ຄຳຄົ້ນ) ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-[11px] font-semibold text-slate-500">ເຄມເປີດຢູ່</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{summary.openCount}</p>
          <p className="text-xs text-slate-400">
            ຍອດຄ້າງ <b className="tabular-nums text-amber-700">{money(summary.openAmount)}</b> ບາດ
          </p>
        </div>

        {type === "A" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold text-slate-500">ລໍ supplier ກວດ</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">
                {(counts.sent ?? 0) + (counts.review ?? 0)}
              </p>
              <p className="text-xs text-slate-400">
                ສົ່ງແລ້ວ <b className="tabular-nums">{counts.sent ?? 0}</b> · ກຳລັງກວດ{" "}
                <b className="tabular-nums">{counts.review ?? 0}</b>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold text-slate-500">ອະນຸມັດແລ້ວ · ລໍຮັບຂອງ/ເຄຣດິດ</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">{counts.approved ?? 0}</p>
              <p className="text-xs text-slate-400">
                ຍອດ <b className="tabular-nums">{money(summary.approvedAmount)}</b> ບາດ
              </p>
            </div>
          </>
        )}

        {type === "B" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold text-slate-500">ຂອບເຂດເຄມ</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">{scopeSummary.scope.whole ?? 0}</p>
              <p className="text-xs text-slate-400">
                ທັງເຄື່ອງ · ສະເພາະອາໄຫຼ່ <b className="tabular-nums">{scopeSummary.scope.part ?? 0}</b> ໃບ
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold text-slate-500">ຈັດການໂດຍເຄມຕໍ່ supplier</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">{scopeSummary.fulfillment.supplier ?? 0}</p>
              <p className="text-xs text-slate-400">
                stock <b className="tabular-nums">{scopeSummary.fulfillment.stock ?? 0}</b> · ຊື້ໃໝ່{" "}
                <b className="tabular-nums">{scopeSummary.fulfillment.purchase ?? 0}</b>
              </p>
            </div>
          </>
        )}

        {type === "C" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold text-slate-500">ຍັງບໍ່ແຈ້ງ supplier</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">{counts.notify ?? 0}</p>
              <p className="text-xs text-slate-400">
                ງານພ້ອມເປີດໃບເຄມ <b className="tabular-nums">{candidates.length}</b> ງານ
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold text-slate-500">ແຈ້ງແລ້ວ · ລໍຊຳລະ</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">{counts.notified ?? 0}</p>
              <p className="text-xs text-slate-400">
                ຍອດ <b className="tabular-nums">{money(summary.notifiedAmount)}</b> ບາດ
              </p>
            </div>
          </>
        )}

        {type !== "B" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            {type === "A" ? (
              <>
                <p className="text-[11px] font-semibold text-slate-500">ຄ້າງດົນສຸດ</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${summary.oldestDays >= 30 ? "text-red-600" : summary.oldestDays >= 7 ? "text-amber-700" : "text-slate-700"}`}>
                  {summary.oldestDays} ມື້
                </p>
                <p className="text-xs text-slate-400">
                  ເຄມນຳ <b className="tabular-nums">{summary.suppliers}</b> supplier
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-slate-500">ເກັບເງິນແລ້ວ</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{counts.paid ?? 0}</p>
                <p className="text-xs text-slate-400">
                  ຍອດ <b className="tabular-nums">{money(summary.paidAmount)}</b> ບາດ
                </p>
              </>
            )}
          </div>
        )}
        {type === "B" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold text-slate-500">ຄ້າງດົນສຸດ</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${summary.oldestDays >= 30 ? "text-red-600" : summary.oldestDays >= 7 ? "text-amber-700" : "text-slate-700"}`}>
              {summary.oldestDays} ມື້
            </p>
            <p className="text-xs text-slate-400">
              ກຳລັງກວດ/ຕັດສິນ <b className="tabular-nums">{counts.checking ?? 0}</b> ໃບ
            </p>
          </div>
        )}
      </div>

      {/* ── status chips ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={link()} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${!status ? "bg-brand-700 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
          ທັງໝົດ <span className="tabular-nums opacity-80">{total}</span>
        </Link>
        {CLAIM_FLOW[type].map((s) => (
          <Link key={s.status} href={link(s.status)} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${status === s.status ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {s.label} <span className="tabular-nums opacity-80">{counts[s.status] ?? 0}</span>
          </Link>
        ))}
        {type === "A" && (counts.rejected ?? 0) > 0 && (
          <Link href={link("rejected")} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${status === "rejected" ? "bg-brand-700 text-white" : "bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50"}`}>
            ปฏิเสธ <span className="tabular-nums opacity-80">{counts.rejected ?? 0}</span>
          </Link>
        )}
      </div>

      {type === "C" && candidates.length > 0 && (
        <div className="rounded-2xl border border-brand-orange-400 bg-brand-orange-100/60 p-4">
          <p className="mb-2 text-xs font-bold text-brand-900">
            ງານສ່ງຄືນแล้ว · ໝາຍ ເຄມ supplier · ຍັງບໍ່ມີໃບເຄມ ({candidates.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {candidates.map((c) => (
              <Link
                key={c.code}
                href={`/claims/new?type=C&ref_job=${c.code}${c.brand ? `&brand=${encodeURIComponent(c.brand)}` : ""}${c.supplier ? `&supplier=${encodeURIComponent(c.supplier)}` : ""}`}
                className="flex items-center gap-2 rounded-xl border border-brand-orange-400 bg-white p-2.5 text-[12px] shadow-sm hover:border-brand-300 hover:bg-brand-50/40"
              >
                <FilePlus2 className="size-4 shrink-0 text-brand-700" />
                <span className="min-w-0 flex-1">
                  <b className="text-brand">{c.code}</b> · {c.brand || "-"}
                  <span className="block truncate text-slate-500">{[c.product, c.customer].filter(Boolean).join(" · ") || "-"} · ຄືນ {c.returned_at || "-"}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <form action={basePath} method="get" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="ຄົ້ນ ເລກເຄມ · supplier · ເລກງານ · ຮ້ານ" className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-brand-600" />
        </div>
        <button className="h-9 rounded-lg bg-brand-900 px-4 text-xs font-semibold text-white">ຄົ້ນ</button>
      </form>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">
          {total === 0 ? "ຍັງບໍ່ມີໃບເຄມ" : "ບໍ່ພົບໃບເຄມທີ່ກົງກັບຄຳຄົ້ນ/ສະຖານະນີ້"}
        </p>
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
                <th className="px-3 py-2 font-semibold">ຂອບເຂດເຄມ</th>
                <th className="px-3 py-2 text-right font-semibold">ຍອດ</th>
                <th className="px-3 py-2 font-semibold">ເປີດ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.claim_no} className={`border-b border-slate-100 hover:bg-slate-50 ${isClaimOpen(r.status) ? "" : "bg-slate-50/60"}`}>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-brand">
                    <Link href={`/claims/${r.claim_no}`} className="hover:underline">{r.claim_no}</Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${tone(r.status)}`}>{r.status_label}</span>
                  </td>
                  <td className="px-3 py-2">{r.customer_name || r.supplier_code || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.brand_code || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.ref_job || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.claim_scope ? CLAIM_SCOPE_LABEL[r.claim_scope] ?? r.claim_scope : "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.amount ? r.amount.toLocaleString() : "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.created_at || "-"}{r.created_by ? ` · ${r.created_by}` : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2"><ClaimRowActions claimNo={r.claim_no} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
