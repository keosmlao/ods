import {
  PURCHASE_STATE,
  WITHDRAW_STATE,
  type ErpChain,
  type PurchaseRound,
  type WithdrawRound,
} from "@/lib/repair-spare-rounds";
import { PackageSearch, ShoppingCart } from "lucide-react";
import Link from "next/link";

/**
 * **ອາໄຫຼ່ຂອງໃບງານ ແຍກເປັນ "ຮອບ"** — ຂໍເບີກຫຼາຍເທື່ອ ແລະ ສັ່ງຊື້ຫຼາຍເທື່ອ ເປັນເລື່ອງປົກກະຕິ
 * (399 ໃບງານຂໍເບີກ >1 ຮອບ · 81 ໃບສັ່ງຊື້ >1 ຮອບ) ແຕ່ແຕ່ກ່ອນເຫັນພຽງ "ອາໄຫຼ່" ກ້ອນດຽວ
 * ⇒ ບອກບໍ່ໄດ້ວ່າ **ຮອບໃດຄ້າງຢູ່ໃສ ແລະ ໃຜຕ້ອງລົງມືຕໍ່**.
 *
 * ແຕ່ລະແຖວ = 1 ໃບເອກະສານຈິງ ⇒ ກົດເປີດເບິ່ງໃບນັ້ນໄດ້ເລີຍ.
 */
export function SpareRounds({
  code,
  roworder,
  withdrawals,
  purchases,
  erp = {},
  canRequest = false,
}: {
  code: string;
  /** key ຂອງໜ້າ /stock/requests/[roworder] — ບ່ອນອອກໃບຂໍເບີກຮອບໃໝ່ */
  roworder: string;
  withdrawals: WithdrawRound[];
  purchases: PurchaseRound[];
  /** ຕ່ອງໂສ້ ERP ຂອງແຕ່ລະໃບຂໍຊື້ (RQ → SPR → PO → ຮັບເຂົ້າສາງ) */
  erp?: Record<string, ErpChain>;
  /** ເປີດປຸ່ມ "ຂໍເບີກ/ຂໍຊື້ ຮອບໃໝ່" (ວຽກຍັງບໍ່ຈົບ ແລະ ຜູ້ໃຊ້ມີສິດ) */
  canRequest?: boolean;
}) {
  if (withdrawals.length === 0 && purchases.length === 0 && !canRequest) return null;

  const waiting = withdrawals.filter((row) => row.state !== "received").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">
        <PackageSearch className="size-4 text-teal-600" />
        ອາໄຫຼ່ຂອງໃບງານ
        <span className="text-[11px] font-medium text-slate-400">
          ຂໍເບີກ {withdrawals.length} ຮອບ
          {purchases.length > 0 && ` · ສັ່ງຊື້ ${purchases.length} ຮອບ`}
        </span>
        {waiting > 0 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            ຄ້າງ {waiting} ຮອບ
          </span>
        )}
        {canRequest && (
          <span className="ml-auto flex items-center gap-2">
            {/* ຂໍເບີກ/ຂໍຊື້ **ຮອບໃໝ່** ໄດ້ຕະຫຼອດ ຕາບໃດວຽກຍັງບໍ່ຈົບ — ຮອບເກົ່າຄ້າງຢູ່ກໍ່ຂໍໄດ້ */}
            <Link
              href={`/stock/requests/${encodeURIComponent(roworder)}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
            >
              + ຂໍເບີກຮອບໃໝ່
            </Link>
            <Link
              href={`/purchase-requests/new/${encodeURIComponent(code)}/direct`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              + ຂໍຊື້ຮອບໃໝ່
            </Link>
          </span>
        )}
      </h2>

      {withdrawals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">ຮອບ</th>
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">ໃບຂໍເບີກ</th>
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">ວັນທີ</th>
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">ລາຍການ</th>
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">ສາງເບີກ (SWC)</th>
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">ຊ່າງຮັບ (PISP)</th>
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">ສະຖານະ</th>
                <th className="whitespace-nowrap py-2 pr-3 font-semibold">ລໍໃຜ</th>
                <th className="whitespace-nowrap py-2 font-semibold">ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((row) => {
                const state = WITHDRAW_STATE[row.state];
                return (
                  <tr key={row.doc_no} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-3 font-bold text-slate-500">{row.round}</td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <Link
                        href={`/stock/requests/view/${encodeURIComponent(row.doc_no)}`}
                        className="font-mono font-semibold text-teal-700 hover:underline"
                      >
                        {row.doc_no}
                      </Link>
                      {row.wh_code && <span className="ml-1.5 text-[10px] text-slate-400">ສາງ {row.wh_code}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{row.doc_date ?? "-"}</td>
                    <td className="max-w-72 py-2 pr-3 text-slate-700">
                      {row.items.length > 0 ? (
                        <span className="flex flex-col gap-0.5">
                          {row.items.map((item) => (
                            <span key={item.item_code} className="block truncate" title={`${item.item_code} · ${item.item_name ?? ""}`}>
                              {item.item_name || item.item_code}
                              <b className="ml-1 text-slate-500">× {item.qty}</b>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <>{row.lines} ລາຍການ · {row.qty}</>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-slate-500">
                      {row.dispatch_no ?? "—"}
                      {row.dispatch_date && <span className="ml-1 text-slate-400">{row.dispatch_date}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-slate-500">
                      {row.pick_no ?? "—"}
                      {row.pick_date && <span className="ml-1 text-slate-400">{row.pick_date}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state.tone}`}>
                        {state.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{state.next}</td>
                    <td className="whitespace-nowrap py-2">
                      {/* ປຸ່ມລົງມື **ຢູ່ໃນແຖວຂອງມັນເອງ** — ຮັບອາໄຫຼ່ຂອງໃບເບີກໃບນີ້ໂດຍກົງ */}
                      {row.state === "dispatched" && row.dispatch_no && (
                        <Link
                          href={`/stock/requests/pickup/${encodeURIComponent(row.dispatch_no.split(",")[0].trim())}`}
                          className="inline-flex h-7 items-center rounded-lg bg-teal-600 px-2.5 text-[11px] font-semibold text-white hover:bg-teal-700"
                        >
                          ຮັບອາໄຫຼ່
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {purchases.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <ShoppingCart className="size-3.5 text-indigo-600" />
            ຮອບສັ່ງຊື້ (ສາງບໍ່ມີ ⇒ ຂໍຊື້)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ຮອບ</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ໃບຂໍຊື້</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ວັນທີ</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ມາຈາກໃບຂໍເບີກ</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ສະຖານະ</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ໃບ ERP (SPR)</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ອະນຸມັດ</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ໃບສັ່ງຊື້ (PO)</th>
                  <th className="whitespace-nowrap py-2 pr-3 font-semibold">ຮັບເຂົ້າສາງ</th>
                  <th className="whitespace-nowrap py-2 font-semibold">ລໍໃຜ</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((row) => {
                  const state = PURCHASE_STATE[row.state];
                  return (
                    <tr key={row.doc_no} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 pr-3 font-bold text-slate-500">{row.round}</td>
                      <td className="whitespace-nowrap py-2 pr-3 font-mono font-semibold text-slate-700">
                        {row.doc_no}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-500">{row.doc_date ?? "-"}</td>
                      <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-slate-500">
                        {row.from_request ?? "—"}
                      </td>
                      
                      <td className="whitespace-nowrap py-2 pr-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state.tone}`}>
                          {state.label}
                        </span>
                      </td>
                      {/* ── ຕ່ອງໂສ້ຝັ່ງ ERP ຂອງຮອບນີ້ (SPR → ອະນຸມັດ → PO → ຮັບເຂົ້າສາງ) ── */}
                      <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-slate-600">
                        {erp[row.doc_no]?.spr_no ?? "—"}
                        {erp[row.doc_no]?.spr_date && (
                          <span className="ml-1 font-sans text-slate-400">{erp[row.doc_no]?.spr_date}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-slate-600">
                        {erp[row.doc_no]?.approve_no ?? "—"}
                        {erp[row.doc_no]?.approve_date && (
                          <span className="ml-1 font-sans text-slate-400">{erp[row.doc_no]?.approve_date}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 font-mono text-[11px] text-slate-600">
                        {erp[row.doc_no]?.order_no ?? "—"}
                        {erp[row.doc_no]?.order_date && (
                          <span className="ml-1 font-sans text-slate-400">{erp[row.doc_no]?.order_date}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-[11px]">
                        {erp[row.doc_no]?.receipt_no ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                            <span className="font-mono">{erp[row.doc_no]?.receipt_no}</span>
                            <span className="ml-1 font-normal">{erp[row.doc_no]?.receipt_date}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">ຍັງບໍ່ຮັບເຂົ້າ</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 text-slate-500">
                        {erp[row.doc_no]?.receipt_no ? "ສາງ (ເບີກຕໍ່)" : state.next}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            ຄໍລຳຂວາ = ຕ່ອງໂສ້ຈິງຢູ່ ERP ຂອງຮອບນັ້ນ. ຮັບເຂົ້າສາງແລ້ວ ⇒ ຍັງເຫຼືອ 2 ຂັ້ນ: ສາງຈ່າຍອອກ (SWC) ແລ້ວຊ່າງກົດຮັບ (PISP)
          </p>
        </div>
      )}
    </section>
  );
}
