import {
  PURCHASE_STATE,
  WITHDRAW_STATE,
  type DocItem,
  type ErpChain,
  type PurchaseRound,
  type WithdrawRound,
} from "@/lib/repair-spare-rounds";
import { CheckCircle2, ClipboardList, PackageCheck, PackageSearch, ShoppingCart, Wrench } from "lucide-react";
import { compareItems } from "@/lib/doc-item-diff";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * **ອາໄຫຼ່ຂອງໃບງານ ແຍກເປັນ "ຮອບ" — ວາງເປັນ tree ລົງ**.
 *
 * ── ເປັນຫຍັງ tree ບໍ່ແມ່ນຕາຕະລາງ ──
 * ຂັ້ນຕອນອາໄຫຼ່ແມ່ນ **ຕ່ອງໂສ້ເອກະສານ** ໃບໜຶ່ງເກີດຈາກອີກໃບ:
 *   ຂໍເບີກ SIO → (ສາງບໍ່ມີ ⇒ ຂໍຊື້ RQ → SPR → ອະນຸມັດ → PO → ຮັບເຂົ້າສາງ) → ສາງເບີກ SWC → ຊ່າງຮັບ PISP
 * ວາງເປັນຕາຕະລາງກວ້າງ ⇒ ຄວາມສຳພັນ "ໃບນີ້ມາຈາກໃບນັ້ນ" ຫາຍໄປ, ຊື່ສິນຄ້າຊ້ຳຫຼາຍບ່ອນ ແລະ ລົ້ນຈໍ.
 * ວາງເປັນ tree ລົງ ⇒ ອ່ານແຖວດຽວຈາກເທິງລົງລຸ່ມ ຮູ້ທັນທີວ່າ **ຮອບນີ້ຄ້າງຢູ່ຂັ້ນໃດ ແລະ ໃຜຕ້ອງລົງມືຕໍ່**.
 *
 * ຮອບ = 1 ໃບຂໍເບີກ. ໃບຂໍຊື້ຜູກເຂົ້າຮອບຂອງມັນຜ່ານ `from_request`;
 * ໃບຂໍຊື້ທີ່ບໍ່ມີໃບຂໍເບີກຕົ້ນທາງ (ຂໍຊື້ກົງ) ຢູ່ເປັນຮອບຂອງຕົນເອງທ້າຍລາຍການ.
 */
/**
 * ລິ້ງຕ່າງກັນລະຫວ່າງ **ສ້ອມ** ກັບ **ຕິດຕັ້ງ** (ຄົນລະຊຸດໜ້າ) — ສ່ວນຕ່ອງໂສ້ເອກະສານຄືກັນທຸກຢ່າງ
 * (ວັດ 04-08-2026: ຕິດຕັ້ງໃຊ້ SION 122 → SWC 56 → PISP 166 ຄືກັບສ້ອມ ແລະ ຫຼາຍຮອບໜັກກວ່າ —
 * 312 ວຽກຂໍເບີກ >1 ຮອບ ສູງສຸດ 10 ຮອບ) ⇒ ໃຊ້ອົງປະກອບດຽວກັນ ປ່ຽນແຕ່ລິ້ງ.
 */
export type SpareLinks = {
  newRequest: string;
  /** null = ຝັ່ງນັ້ນບໍ່ມີການຂໍຊື້ (ຕິດຕັ້ງມີ RQ 0 ໃບ) */
  newPurchase: string | null;
  viewRequest: (docNo: string) => string;
  pickup: (dispatchNo: string) => string;
};

export function SpareRounds({
  code,
  roworder,
  withdrawals,
  purchases,
  erp = {},
  canRequest = false,
  links,
  docAction,
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
  links?: SpareLinks;
  /** ປຸ່ມເພີ່ມຢູ່ແຖວໃບຂໍເບີກ (ຕິດຕັ້ງ: ແກ້ໄຂ/ຍົກເລີກ ຕອນສາງຍັງບໍ່ເບີກ) */
  docAction?: (docNo: string, dispatched: boolean) => ReactNode;
}) {
  const url: SpareLinks = links ?? {
    newRequest: `/stock/requests/${encodeURIComponent(roworder)}`,
    newPurchase: `/purchase-requests/new/${encodeURIComponent(code)}/direct`,
    viewRequest: (docNo) => `/stock/requests/view/${encodeURIComponent(docNo)}`,
    pickup: (docNo) => `/stock/requests/pickup/${encodeURIComponent(docNo)}`,
  };
  if (withdrawals.length === 0 && purchases.length === 0 && !canRequest) return null;

  const waiting = withdrawals.filter((row) => row.state !== "received").length;
  /** ຂໍຊື້ກົງ (ບໍ່ໄດ້ເກີດຈາກໃບຂໍເບີກໃບໃດ) ⇒ ບໍ່ມີຮາກ, ຕ້ອງໂຊ້ວແຍກ */
  const requestNos = new Set(withdrawals.map((row) => row.doc_no));
  const orphanPurchases = purchases.filter((row) => !row.from_request || !requestNos.has(row.from_request));

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
              href={url.newRequest}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
            >
              + ຂໍເບີກຮອບໃໝ່
            </Link>
            {url.newPurchase && (
              <Link
                href={url.newPurchase}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                + ຂໍຊື້ຮອບໃໝ່
              </Link>
            )}
          </span>
        )}
      </h2>

      <div className="flex flex-col gap-3">
        {withdrawals.map((row) => (
          <RoundTree
            key={row.doc_no}
            round={row.round}
            withdrawal={row}
            purchases={purchases.filter((p) => p.from_request === row.doc_no)}
            erp={erp}
            url={url}
            docAction={docAction}
          />
        ))}
        {orphanPurchases.map((row) => (
          <RoundTree key={row.doc_no} round={row.round} purchases={[row]} erp={erp} url={url} label="ຂໍຊື້ກົງ" />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        ອ່ານຈາກເທິງລົງລຸ່ມ = ລຳດັບຈິງຂອງເອກະສານ. ຮັບເຂົ້າສາງແລ້ວ ⇒ ຍັງເຫຼືອ 2 ຂັ້ນ: ສາງຈ່າຍອອກ (SWC) ແລ້ວຊ່າງກົດຮັບ (PISP)
      </p>
    </section>
  );
}

/** 1 ຮອບ = 1 ຕົ້ນໄມ້: ຮາກຄືໃບຂໍເບີກ, ງ່າຄືເອກະສານທີ່ເກີດຕາມມາ */
function RoundTree({
  round,
  withdrawal,
  purchases,
  erp,
  url,
  docAction,
  label,
}: {
  round: number;
  withdrawal?: WithdrawRound;
  purchases: PurchaseRound[];
  erp: Record<string, ErpChain>;
  url: SpareLinks;
  docAction?: (docNo: string, dispatched: boolean) => ReactNode;
  label?: string;
}) {
  const state = withdrawal ? WITHDRAW_STATE[withdrawal.state] : null;
  const items = withdrawal?.items ?? purchases[0]?.items ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      {/* ── ຮາກ: ໃບຂໍເບີກ ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
          {label ?? `ຮອບ ${round}`}
        </span>
        <ClipboardList className="size-3.5 text-teal-600" />
        {withdrawal ? (
          <Link
            href={url.viewRequest(withdrawal.doc_no)}
            className="font-mono text-xs font-bold text-teal-700 hover:underline"
          >
            {withdrawal.doc_no}
          </Link>
        ) : (
          <span className="text-xs font-semibold text-slate-500">ບໍ່ຜ່ານໃບຂໍເບີກ</span>
        )}
        {withdrawal?.doc_date && <span className="text-[11px] text-slate-500">{withdrawal.doc_date}</span>}
        {withdrawal?.wh_code && <span className="text-[10px] text-slate-400">ສາງ {withdrawal.wh_code}</span>}
        {state && (
          <span className="ml-auto flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state.tone}`}>{state.label}</span>
            {state.next !== "—" && <span className="text-[10px] text-slate-400">ລໍ {state.next}</span>}
            {withdrawal && docAction?.(withdrawal.doc_no, Boolean(withdrawal.dispatch_no))}
          </span>
        )}
      </div>

      {/* ── ງ່າ: ລາຍການສິນຄ້າ ແລ້ວຕ່ອງໂສ້ເອກະສານລົງມາ ── */}
      <div className="ml-6 border-l border-slate-200 pb-2 pl-0">
        {items.map((item) => (
          <ItemLine key={item.item_code} item={item} />
        ))}

        {/* ສາງບໍ່ມີ ⇒ ຂໍຊື້ (ພ້ອມຕ່ອງໂສ້ ERP ຂອງມັນ) */}
        {purchases.map((buy) => (
          <PurchaseBranch key={buy.doc_no} buy={buy} chain={erp[buy.doc_no]} />
        ))}

        {/* ສາງຈ່າຍອອກ — ທຽບກັບ "ທີ່ຂໍ" */}
        {withdrawal && (
          <Node
            icon={<PackageCheck className="size-3.5" />}
            tone={withdrawal.dispatch_no ? "text-emerald-600" : "text-slate-300"}
            title="ສາງເບີກ (SWC)"
            docNo={withdrawal.dispatch_no}
            docDate={withdrawal.dispatch_date}
            pending="ລໍສາງເບີກອອກ"
            items={withdrawal.dispatch_items}
            against={withdrawal.dispatch_no ? withdrawal.items : undefined}
            againstLabel="ທີ່ຂໍ"
            action={
              withdrawal.state === "dispatched" && withdrawal.dispatch_no ? (
                <Link
                  href={url.pickup(withdrawal.dispatch_no.split(",")[0].trim())}
                  className="inline-flex h-7 items-center rounded-lg bg-teal-600 px-2.5 text-[11px] font-semibold text-white hover:bg-teal-700"
                >
                  ຮັບອາໄຫຼ່
                </Link>
              ) : null
            }
          />
        )}

        {/* ຊ່າງກົດຮັບ — ທຽບກັບ "ທີ່ສາງເບີກ" (ໃບເກົ່າບາງໃບບໍ່ມີລາຍການ ⇒ ບໍ່ທຽບ) */}
        {withdrawal && (
          <Node
            icon={<Wrench className="size-3.5" />}
            tone={withdrawal.pick_no ? "text-emerald-600" : "text-slate-300"}
            title="ຊ່າງຮັບ (PISP)"
            docNo={withdrawal.pick_no}
            docDate={withdrawal.pick_date}
            pending="ລໍຊ່າງກົດຮັບ"
            items={withdrawal.pick_items}
            against={withdrawal.pick_items.length > 0 ? withdrawal.dispatch_items : undefined}
            againstLabel="ທີ່ສາງເບີກ"
          />
        )}
      </div>
    </div>
  );
}

/** ງ່າຂໍຊື້ + ຕ່ອງໂສ້ ERP ຂອງມັນ (ລົງອີກຊັ້ນ) */
function PurchaseBranch({ buy, chain }: { buy: PurchaseRound; chain?: ErpChain }) {
  const state = PURCHASE_STATE[buy.state];
  return (
    <div>
      <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 pl-5">
        <Elbow />
        <ShoppingCart className="size-3.5 text-indigo-600" />
        <span className="font-mono text-[11px] font-semibold text-slate-700">{buy.doc_no}</span>
        {buy.doc_date && <span className="text-[11px] text-slate-500">{buy.doc_date}</span>}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state.tone}`}>{state.label}</span>
      </div>
      {/* ຕ່ອງໂສ້ຝັ່ງ ERP — ຢູ່ໃຕ້ໃບຂໍຊື້ທີ່ເປັນເຈົ້າຂອງມັນ. ແຕ່ລະຂັ້ນທຽບກັບຂັ້ນກ່ອນໜ້າ ⇒ ຫຼຸດ/ເກີນ = ແດງ */}
      <div className="ml-5 border-l border-dashed border-indigo-200">
        {chain?.mismatch && (
          <p className="ml-5 mt-1 rounded bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700">
            ⚠️ ໃບ ERP ເລກນີ້ບໍ່ມີສິນຄ້າກົງກັບໃບຂໍຊື້ຂອງວຽກນີ້ເລີຍ — ອາດເປັນເລກຊົນກັນ (ຄົນລະໃບ) ໃຫ້ກວດກັບຈັດຊື້ກ່ອນເຊື່ອ
          </p>
        )}
        <Node
          icon={<Dot />}
          tone="text-indigo-500"
          title="ໃບ ERP (SPR)"
          docNo={chain?.spr_no ?? null}
          docDate={chain?.spr_date ?? null}
          pending="ລໍ ERP ຮັບໃບ"
          items={chain?.spr_items}
          against={chain?.spr_no && !chain.mismatch ? buy.items : undefined}
          againstLabel="ໃບຂໍຊື້"
        />
        <Node
          icon={<Dot />}
          tone="text-indigo-500"
          title="ອະນຸມັດ (WPRA)"
          docNo={chain?.approve_no ?? null}
          docDate={chain?.approve_date ?? null}
          pending="ລໍອະນຸມັດ"
          items={chain?.approve_items}
          against={chain?.approve_no ? chain.spr_items : undefined}
          againstLabel="ໃບ SPR"
        />
        <Node
          icon={<Dot />}
          tone="text-indigo-500"
          title="ໃບສັ່ງຊື້ (PO)"
          docNo={chain?.order_no ?? null}
          docDate={chain?.order_date ?? null}
          pending="ລໍອອກໃບສັ່ງຊື້"
          items={chain?.order_items}
          against={chain?.order_no ? chain.approve_items : undefined}
          againstLabel="ໃບອະນຸມັດ"
        />
        <Node
          icon={<CheckCircle2 className="size-3.5" />}
          tone={chain?.receipt_no ? "text-emerald-600" : "text-slate-300"}
          title="ຮັບເຂົ້າສາງ (PUI)"
          docNo={chain?.receipt_no ?? null}
          docDate={chain?.receipt_date ?? null}
          pending="ຍັງບໍ່ຮັບເຂົ້າ"
          items={chain?.receipt_items}
          against={chain?.receipt_no ? chain.order_items : undefined}
          againstLabel="ໃບສັ່ງຊື້"
        />
      </div>
    </div>
  );
}

/**
 * 1 ຂັ້ນໃນຕ່ອງໂສ້ — ມີເລກໃບ = ຜ່ານແລ້ວ, ບໍ່ມີ = ຄ້າງຢູ່ຂັ້ນນີ້.
 *
 * ໃສ່ `against` ⇒ ທຽບລາຍການຂັ້ນນີ້ກັບຂັ້ນກ່ອນໜ້າ ແລ້ວ **ຂຶ້ນສີແດງບ່ອນທີ່ບໍ່ຄືກັນ**
 * (ຂໍ 2 ເບີກ 1 · ເບີກຂອງທີ່ບໍ່ໄດ້ຂໍ · ຊ່າງຮັບບໍ່ຄົບ). ຂໍ້ມູນຈິງ: 79 ຄູ່ SIO↔SWC ແຖວບໍ່ຄືກັນ · 82 ຄູ່ຈຳນວນບໍ່ຄືກັນ.
 */
function Node({
  icon,
  tone,
  title,
  docNo,
  docDate,
  pending,
  action,
  items = [],
  against,
  againstLabel,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  docNo: string | null;
  docDate: string | null;
  pending: string;
  action?: ReactNode;
  /** ລາຍການຂອງໃບນີ້ */
  items?: DocItem[];
  /** ລາຍການຂັ້ນກ່ອນໜ້າທີ່ເອົາມາທຽບ — ບໍ່ໃສ່ = ບໍ່ທຽບ */
  against?: DocItem[];
  againstLabel?: string;
}) {
  const diff = against ? compareItems(items, against) : null;

  return (
    <div>
      <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 pl-5">
        <Elbow />
        <span className={tone}>{icon}</span>
        <span className="text-[11px] text-slate-500">{title}</span>
        {docNo ? (
          <>
            <span className="font-mono text-[11px] font-semibold text-slate-700">{docNo}</span>
            {docDate && <span className="text-[11px] text-slate-400">{docDate}</span>}
          </>
        ) : (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{pending}</span>
        )}
        {diff?.mismatch && (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
            ບໍ່ຄືກັບ{againstLabel}
          </span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {(diff?.rows.length ?? 0) > 0 && (
        <div className="ml-5 border-l border-slate-200">
          {diff!.rows.map((row) => (
            <ItemLine key={row.item_code} item={row} expected={row.expected} />
          ))}
        </div>
      )}
      {!diff && items.length > 0 && (
        <div className="ml-5 border-l border-slate-200">
          {items.map((item) => (
            <ItemLine key={item.item_code} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/** ລາຍການ + ຈຳນວນ; ຕ່າງຈາກຂັ້ນກ່ອນໜ້າ ⇒ ແດງ ພ້ອມບອກຈຳນວນທີ່ຄາດໄວ້ */
function ItemLine({ item, expected }: { item: DocItem; expected?: number }) {
  const off = expected !== undefined && expected !== item.qty;
  return (
    <div className="relative flex items-center gap-2 py-1 pl-5">
      <Elbow />
      <span
        className={`truncate text-[11px] ${off ? "font-semibold text-red-700" : "text-slate-600"}`}
        title={item.item_code}
      >
        {item.item_name || item.item_code}
      </span>
      <b className={`whitespace-nowrap text-[11px] ${off ? "text-red-700" : "text-slate-500"}`}>× {item.qty}</b>
      {off && (
        <span className="whitespace-nowrap rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
          {item.qty === 0 ? `ຂາດ ${expected}` : `ຄວນເປັນ ${expected}`}
        </span>
      )}
    </div>
  );
}

/** ຂໍ້ຕໍ່ຈາກເສັ້ນຕັ້ງຂອງງ່າ ມາຫາແຖວນີ້ (ຮູບ ├) */
function Elbow() {
  return <span className="absolute left-0 top-1/2 h-px w-4 bg-slate-200" aria-hidden />;
}

function Dot() {
  return <span className="block size-1.5 rounded-full bg-current" aria-hidden />;
}
