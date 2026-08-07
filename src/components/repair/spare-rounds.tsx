import {
  PURCHASE_STATE,
  WITHDRAW_STATE,
  type DispatchDoc,
  type DocItem,
  type ErpChain,
  type PurchaseRound,
  type ReturnDoc,
  type WithdrawRound,
} from "@/lib/repair-spare-rounds";
import { CheckCircle2, ClipboardList, PackageCheck, PackageSearch, ShoppingCart, Undo2, Wrench } from "lucide-react";
import { ReturnRequestButton } from "@/components/repair/return-request-button";
import { compareItems } from "@/lib/doc-item-diff";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
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
/** ຄຳແປຂອງແຜງນີ້ — ດຶງຄັ້ງດຽວຢູ່ SpareRounds ແລ້ວສົ່ງລົງທຸກງ່າ (ບໍ່ໃຫ້ແຕ່ລະ node ດຶງເອງ) */
type T = Dictionary["spareRounds"];
/** ຕື່ມຄ່າໃສ່ຄຳແປ: fill(t.round, { n: 2 }) */
const fill = (text: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((out, [key, value]) => out.replaceAll(`{${key}}`, String(value)), text);

export type SpareLinks = {
  newRequest: string;
  /** null = ຝັ່ງນັ້ນບໍ່ມີການຂໍຊື້ (ຕິດຕັ້ງມີ RQ 0 ໃບ) */
  newPurchase: string | null;
  viewRequest: (docNo: string) => string;
  pickup: (dispatchNo: string) => string;
  /**
   * ໜ້າ **ສົ່ງຄືນອາໄຫຼ່** ຂອງໃບງານນີ້ — ໃຊ້ຕອນລົງມືສ້ອມແລ້ວພົບວ່າບໍ່ຕ້ອງໃຊ້
   * ຫຼື ເບີກມາຜິດຕົວ. null = ຝັ່ງນັ້ນບໍ່ມີ.
   */
  returnSpare: string | null;
  /**
   * ໜ້າ **ຂໍຄືນອາໄຫຼ່ຂອງໃບເບີກໃບນັ້ນ** — ໃບຄືນ (SRI) ຜູກກັບໃບເບີກ (SWC) ໂດຍກົງ
   * (ເບິ່ງ saveReturn ຢູ່ actions/stock: `doc_ref` = ເລກໃບເບີກ) ⇒ ປຸ່ມຈຶ່ງຄວນຢູ່ຄຽງ
   * ແຖວໃບເບີກ ບໍ່ແມ່ນລອຍຢູ່ຫົວແຜງ. null = ຝັ່ງນັ້ນໃຊ້ຄົນລະເສັ້ນທາງ (ຕິດຕັ້ງ).
   */
  returnJobType: "repair" | "install" | null;
};

export async function SpareRounds({
  code,
  roworder,
  withdrawals,
  purchases,
  erp = {},
  canRequest = false,
  links,
  docAction,
  jobStarted = false,
  /**
   * ⚠️ ຄ່າຕັ້ງຕົ້ນ **false** (ແກ້ 05-08-2026 — ເມື່ອກ່ອນເປັນ `true`).
   *
   * ຕັ້ງແຕ່ຕັດສິນໃຈ 04-08-2026 ວ່າ "ສາງເບີກແລ້ວ = ຜ່ານ" ຜູ້ເອີ້ນ**ທຸກອັນ**ສົ່ງ false
   * (repair/[code] ແລະ installations/[code]) ⇒ ບໍ່ມີໃຜຢາກໄດ້ `true` ອີກ ແຕ່ຄ່າຕັ້ງຕົ້ນ
   * ຍັງເປັນ true ຄ້າງໄວ້ ⇒ **ໜ້າ /service/[code] ທີ່ບໍ່ໄດ້ສົ່ງ prop ນີ້ ໄດ້ true**
   * ແລ້ວສະແດງ "ສາງເບີກແລ້ວ ລໍຊ່າງຮັບ" + ຂັ້ນ PISP ທັງທີ່ສາງຈ່າຍຄົບແລ້ວ
   * ⇒ **ໃບງານດຽວກັນ ສະຖານະບໍ່ຄືກັນລະຫວ່າງ 2 ໜ້າ** (ພົບ 05-08-2026).
   */
  techReceipt = false,
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
  /**
   * ວຽກເລີ່ມສ້ອມ/ຕິດຕັ້ງແລ້ວ ⇒ ການ "ຮັບອາໄຫຼ່" **ບໍ່ແມ່ນຂັ້ນຕອນວຽກອີກຕໍ່ໄປ** ແຕ່ເປັນການເຊັນເອກະສານຍ້ອນຫຼັງ.
   * ຫຼັກຖານ 04-08-2026: ໃບສາງເບີກ 2,508 ໃບບໍ່ເຄີຍມີໃບຮັບ (PISP) — ໃນນັ້ນ **2,441 ໃບ (97%)
   * ວຽກເລີ່ມສ້ອມໄປແລ້ວ** ແລະ 2,436 ໃບສ້ອມຈົບແລ້ວ ⇒ ຄົນເອົາອາໄຫຼ່ໄປໃຊ້ກ່ອນ ບໍ່ໄດ້ເຊັນ.
   * ຈຶ່ງບໍ່ຄວນເອົາປຸ່ມສີເຂັ້ມມາລໍ້ວ່າ "ຍັງບໍ່ໄດ້ເຮັດ" — ຫຼຸດເປັນປຸ່ມຮອງ ພ້ອມບອກວ່າຄ້າງແຕ່ເອກະສານ.
   */
  jobStarted?: boolean;
  /**
   * ຝັ່ງນີ້ຍັງໃຫ້ຊ່າງກົດຮັບອາໄຫຼ່ບໍ່ (PISP).
   * **ງານສ້ອມ = false** (ຕັດສິນໃຈ 04-08-2026: ສາງເບີກແລ້ວ = ຜ່ານ) ⇒ ບໍ່ໂຊ້ວທັງປຸ່ມ ແລະ ຂັ້ນ PISP.
   * **ງານຕິດຕັ້ງ = true** (ຄືເກົ່າ).
   */
  techReceipt?: boolean;
}) {
  const t = (await getDictionary(await getLocale())).spareRounds;
  const url: SpareLinks = links ?? {
    newRequest: `/stock/requests/${encodeURIComponent(roworder)}`,
    newPurchase: `/purchase-requests/new/${encodeURIComponent(code)}/direct`,
    viewRequest: (docNo) => `/stock/requests/view/${encodeURIComponent(docNo)}`,
    pickup: (docNo) => `/stock/requests/pickup/${encodeURIComponent(docNo)}`,
    // ພາໄປໜ້າສົ່ງຄືນ **ພ້ອມກອງໃສ່ໃບງານນີ້ແລ້ວ** — ບໍ່ໃຫ້ໄປໄລ່ຫາເອງໃນລາຍການທັງໝົດ
    returnSpare: `/stock/receive-returns?q=${encodeURIComponent(code)}`,
    returnJobType: "repair",
  };
  /**
   * ມີຂອງອອກສາງໄປແລ້ວ ຈຶ່ງມີຫຍັງໃຫ້ສົ່ງຄືນ — ຍັງບໍ່ເບີກ ບໍ່ຕ້ອງໂຊ້ວປຸ່ມມາລົບກວນ.
   * (ຢາກຖອດລາຍການທີ່**ຍັງບໍ່ເບີກ** ອອກ ⇒ ແກ້ຢູ່ກ່ອງ "ອາໄຫຼ່ທີ່ຕ້ອງໃຊ້" ບໍ່ແມ່ນສົ່ງຄືນ)
   */
  const hasDispatched = withdrawals.some((row) => Boolean(row.dispatch_no));
  if (withdrawals.length === 0 && purchases.length === 0 && !canRequest) return null;

  const waiting = withdrawals.filter((row) => row.state !== "received").length;
  /**
   * ໃບຂໍຄືນທັງໝົດຂອງວຽກ — ຂຶ້ນຫົວແຜງເພື່ອໃຫ້ຮູ້ **ໂດຍບໍ່ຕ້ອງໄລ່ເປີດແຕ່ລະຮອບ** ວ່າມີຂອງຄືນຄ້າງ.
   * ຄ້າງ = ຂໍໄປແລ້ວແຕ່ສາງຍັງບໍ່ຮັບເຂົ້າ ⇒ ຂອງຍັງຢູ່ມືຊ່າງ ແລະ ສະຕັອກຍັງບໍ່ຄືນ.
   */
  const returns = withdrawals.flatMap((row) => row.dispatches.flatMap((doc: DispatchDoc) => doc.returns));
  const returnsPending = returns.filter((doc) => !doc.receive_no).length;
  /** ຂໍຊື້ກົງ (ບໍ່ໄດ້ເກີດຈາກໃບຂໍເບີກໃບໃດ) ⇒ ບໍ່ມີຮາກ, ຕ້ອງໂຊ້ວແຍກ */
  const requestNos = new Set(withdrawals.map((row) => row.doc_no));
  const orphanPurchases = purchases.filter((row) => !row.from_request || !requestNos.has(row.from_request));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-sm font-bold text-slate-700">
        <PackageSearch className="size-4 text-brand-700" />
        {t.title}
        <span className="text-[11px] font-medium text-slate-400">
          {fill(t.withdrawRounds, { n: withdrawals.length })}
          {purchases.length > 0 && ` · ${fill(t.purchaseRounds, { n: purchases.length })}`}
        </span>
        {waiting > 0 && (
          <span className="rounded bg-brand-orange-300 px-1.5 py-0.5 text-[10px] font-bold text-brand-900">
            {fill(t.pendingRounds, { n: waiting })}
          </span>
        )}
        {returns.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            <Undo2 className="size-3" />
            {fill(t.returnsCount, { n: returns.length })}
            {returnsPending > 0 && <b className="text-brand-orange-700">· {fill(t.returnsPending, { n: returnsPending })}</b>}
          </span>
        )}
        {(canRequest || (hasDispatched && url.returnSpare)) && (
          <span className="ml-auto flex items-center gap-2">
            {/**
              * **ສົ່ງຄືນອາໄຫຼ່** — ລົງມືສ້ອມແລ້ວພົບວ່າບໍ່ຕ້ອງໃຊ້ ຫຼື ເບີກມາຜິດຕົວ.
              * ເມື່ອກ່ອນຕ້ອງໄປຫາໜ້າ /stock/returns ເອງ ແລະ **ເມນູມີແຕ່ຝັ່ງຕິດຕັ້ງ**
              * (`?job=install`) ⇒ ຄົນງານສ້ອມຫາທາງເຂົ້າບໍ່ພົບເລີຍ ທັງທີ່ໜ້າຮອງຮັບຢູ່.
              * ວາງໄວ້ຄຽງກັບ "ຂໍເບີກ/ຂໍຊື້" ເພາະເປັນເລື່ອງອາໄຫຼ່ຂອງໃບງານດຽວກັນ.
              */}
            {hasDispatched && url.returnSpare && (
              <Link
                href={url.returnSpare}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Undo2 className="size-3.5" />
                {t.returnSpare}
              </Link>
            )}
            {/* ຂໍເບີກ/ຂໍຊື້ **ຮອບໃໝ່** ໄດ້ຕະຫຼອດ ຕາບໃດວຽກຍັງບໍ່ຈົບ — ຮອບເກົ່າຄ້າງຢູ່ກໍ່ຂໍໄດ້ */}
            {canRequest && (
            <>
            <Link
              href={url.newRequest}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800"
            >
              {t.newRequest}
            </Link>
            {url.newPurchase && (
              <Link
                href={url.newPurchase}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-orange-400 bg-brand-orange-100 px-3 text-xs font-semibold text-brand-900 hover:bg-brand-orange-300"
              >
                {t.newPurchase}
              </Link>
            )}
            </>
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
            jobStarted={jobStarted}
            techReceipt={techReceipt}
            t={t}
          />
        ))}
        {orphanPurchases.map((row) => (
          <RoundTree key={row.doc_no} round={row.round} purchases={[row]} erp={erp} url={url} label={t.directPurchase} t={t} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        {t.footer}
      </p>
    </section>
  );
}

/** ປ້າຍສະຖານະຮອບ — ເອົາຄຳຈາກ dictionary (WITHDRAW_STATE ເຫຼືອໜ້າທີ່ບອກ **ສີ** ເທົ່ານັ້ນ) */
const stateLabel = (t: T, state: WithdrawRound["state"]) =>
  ({ requested: t.stateRequested, dispatched: t.stateDispatchedWait, received: t.stateReceived })[state];
/** ຜູ້ທີ່ຕ້ອງລົງມືຕໍ່ — ຄ່າໃນ WITHDRAW_STATE.next ເປັນລາວ ⇒ ຈັບຄູ່ມາເປັນຄຳແປ */
const nextLabel = (t: T, next: string) =>
  ({ "ສາງ": t.nextStock, "ຊ່າງ": t.nextTech, "ຜູ້ຈັດການ": t.nextManager, "ຈັດຊື້": t.nextPurchasing })[next] ?? next;

/** 1 ຮອບ = 1 ຕົ້ນໄມ້: ຮາກຄືໃບຂໍເບີກ, ງ່າຄືເອກະສານທີ່ເກີດຕາມມາ */
function RoundTree({
  round,
  withdrawal,
  purchases,
  erp,
  url,
  docAction,
  jobStarted,
  techReceipt,
  label,
  t,
}: {
  round: number;
  withdrawal?: WithdrawRound;
  purchases: PurchaseRound[];
  erp: Record<string, ErpChain>;
  url: SpareLinks;
  docAction?: (docNo: string, dispatched: boolean) => ReactNode;
  jobStarted?: boolean;
  techReceipt?: boolean;
  label?: string;
  t: T;
}) {
  const raw = withdrawal ? WITHDRAW_STATE[withdrawal.state] : null;
  // ບໍ່ມີຂັ້ນ PISP ແລ້ວ ⇒ "ສາງເບີກແລ້ວ" ຄືຈົບ ບໍ່ແມ່ນ "ລໍຊ່າງຮັບ"
  const state =
    raw && !techReceipt && withdrawal?.state === "dispatched"
      ? { ...raw, label: t.stateDispatchedDone, next: "—", tone: "bg-brand-50 text-brand-800" }
      : raw
        ? { ...raw, label: stateLabel(t, withdrawal!.state), next: nextLabel(t, raw.next) }
        : null;
  const items = withdrawal?.items ?? purchases[0]?.items ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/40">
      {/* ── ຮາກ: ໃບຂໍເບີກ ── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2">
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
          {label ?? fill(t.round, { n: round })}
        </span>
        <ClipboardList className="size-3.5 text-brand-700" />
        {withdrawal ? (
          <Link
            href={url.viewRequest(withdrawal.doc_no)}
            className="font-mono text-xs font-bold text-brand-800 hover:underline"
          >
            {withdrawal.doc_no}
          </Link>
        ) : (
          <span className="text-xs font-semibold text-slate-500">{t.noRequestDoc}</span>
        )}
        {withdrawal?.doc_date && <span className="text-[11px] text-slate-500">{withdrawal.doc_date}</span>}
        {withdrawal?.wh_code && <span className="text-[10px] text-slate-400">{fill(t.warehouse, { code: withdrawal.wh_code })}</span>}
        {state && (
          <span className="ml-auto flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state.tone}`}>{label}</span>
            {state.next !== "—" && <span className="text-[10px] text-slate-400">{fill(t.waitingFor, { who: state.next })}</span>}
            {withdrawal && docAction?.(withdrawal.doc_no, Boolean(withdrawal.dispatch_no))}
          </span>
        )}
      </div>

      {/* ── ງ່າ: ລາຍການສິນຄ້າ ແລ້ວຕ່ອງໂສ້ເອກະສານລົງມາ ── */}
      <div className="ml-6 border-l border-slate-200 pb-2 pl-0">
        {items.map((item) => (
          <ItemLine key={item.item_code} item={item} t={t} />
        ))}

        {/* ສາງບໍ່ມີ ⇒ ຂໍຊື້ (ພ້ອມຕ່ອງໂສ້ ERP ຂອງມັນ) */}
        {purchases.map((buy) => (
          <PurchaseBranch key={buy.doc_no} buy={buy} chain={erp[buy.doc_no]} t={t} />
        ))}

        {/**
          * ສາງຈ່າຍອອກ — **ແຍກເປັນລາຍໃບ** ເມື່ອມີຫຼາຍໃບ (05-08-2026).
          * ເມື່ອກ່ອນລວມທຸກໃບເປັນ node ດຽວ (ເລກໃບຄັ່ນດ້ວຍ ", " ແລະ ລາຍການບວກກັນ)
          * ⇒ ພົບຮອບທີ່ມີ 4 ໃບ ແລ້ວ **ບອກບໍ່ໄດ້ວ່າໃບໃດຈ່າຍຫຍັງ** ⇒ ຕາມຂອງ/ທວງສາງບໍ່ຖືກໃບ.
          * ໃບດຽວ ⇒ ຄືເກົ່າທຸກປະການ (ບໍ່ເພີ່ມຄວາມຮົກໃຫ້ກໍລະນີທົ່ວໄປ).
          */}
        {withdrawal && (
          <Node
            icon={<PackageCheck className="size-3.5" />}
            tone={withdrawal.dispatch_no ? "text-brand-800" : "text-slate-300"}
            /**
             * ຫຼາຍໃບ ⇒ node ນີ້ຄື **ຍອດລວມທຽບກັບທີ່ຂໍ** (ບອກວ່າຂາດຫຍັງ) ສ່ວນ
             * "ໃບໃດຈ່າຍຫຍັງ" ຢູ່ຕາຕະລາງຂ້າງລຸ່ມ ⇒ ຕັ້ງຊື່ໃຫ້ຕ່າງກັນ ຄົນຈຶ່ງບໍ່ອ່ານວ່າຊ້ຳ.
             * ແລະ ບໍ່ໂຊ້ວເລກໃບຍາວໆ 4 ໃບຄັ່ນດ້ວຍ comma ອີກ — ຕາຕະລາງລຸ່ມມີຄົບແລ້ວ.
             */
            title={withdrawal.dispatches.length > 1 ? t.dispatchNodeAll : t.dispatchNode}
            docNo={
              withdrawal.dispatches.length > 1
                ? fill(t.docsCount, { n: withdrawal.dispatches.length })
                : withdrawal.dispatch_no
            }
            docDate={withdrawal.dispatch_date}
            pending={t.waitDispatch}
            items={withdrawal.dispatch_items}
            against={withdrawal.dispatch_no ? withdrawal.items : undefined}
            againstLabel={t.againstRequested}
            t={t}
            action={
              <>
                {techReceipt && withdrawal.state === "dispatched" && withdrawal.dispatch_no && (
                  <Link
                    href={url.pickup(withdrawal.dispatch_no.split(",")[0].trim())}
                    className={
                      jobStarted
                        ? "inline-flex h-7 items-center rounded-lg border border-slate-300 px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        : "inline-flex h-7 items-center rounded-lg bg-brand-700 px-2.5 text-[11px] font-semibold text-white hover:bg-brand-800"
                    }
                  >
                    {jobStarted ? t.signBackdated : t.receiveSpare}
                  </Link>
                )}
                {/**
                  * **ຂໍຄືນ** — ຂອງອອກສາງໄປແລ້ວແຕ່ບໍ່ໄດ້ໃຊ້ / ເບີກມາຜິດຕົວ.
                  * ⚠️ ເປັນ **ປຸ່ມ** ບໍ່ແມ່ນລິ້ງ: ຕ້ອງໃຫ້ action ດຶງລາຍການຂອງໃບເບີກ
                  * ເຂົ້າກະຕ່າຮ່າງກ່ອນ ຈຶ່ງພາໄປຟອມ (ເບິ່ງ ReturnRequestButton).
                  * ໃບດຽວ ⇒ ປຸ່ມຢູ່ນີ້ · ຫຼາຍໃບ ⇒ ປຸ່ມຢູ່ແຕ່ລະແຖວຂອງຕາຕະລາງລຸ່ມ.
                  *
                  * ⚠️ **ຂໍຄືນໄປແລ້ວ ⇒ ບໍ່ໂຊ້ວປຸ່ມອີກ** (ງ່າຂໍຄືນຢູ່ລຸ່ມບອກສະຖານະຢູ່ແລ້ວ).
                  * ນອກຈາກກັນຂໍຄືນຊ້ຳ ຍັງກັນທາງຕັນ: ແຖວທີ່ຄືນແລ້ວຖືກໝາຍ status=1 ⇒ ຮ່າງ
                  * ຂອງໃບເບີກນັ້ນຫວ່າງ ⇒ ຟອມຂຶ້ນ "ບໍ່ມີອາໄຫຼ່ໃຫ້ສົ່ງຄືນ" ແລະ ບັນທຶກບໍ່ໄດ້.
                  */}
                {url.returnJobType &&
                  withdrawal.dispatches.length === 1 &&
                  withdrawal.dispatches[0].returns.length === 0 && (
                    <ReturnRequestButton
                      docNo={withdrawal.dispatches[0].doc_no}
                      jobType={url.returnJobType}
                      size="sm"
                    />
                  )}
              </>
            }
          />
        )}

        {/**
          * **ງ່າຂໍຄືນ** — ຂອງອອກສາງໄປແລ້ວ ແລ້ວສົ່ງກັບ. ຂຶ້ນ**ສະເພາະຕອນເຄີຍຂໍຄືນ**
          * (ວຽກສ່ວນຫຼາຍບໍ່ມີ ⇒ ບໍ່ເພີ່ມແຖວຫວ່າງໃຫ້ຮົກ). ຢູ່ໃຕ້ໃບເບີກເພາະໃບຂໍຄືນ
          * ຜູກກັບ **ໃບເບີກ** ໂດຍກົງ (doc_ref = ເລກໃບເບີກ) ບໍ່ແມ່ນຜູກກັບໃບຂໍເບີກ.
          * ໃບດຽວ ⇒ ວາງເປັນຕົ້ນໄມ້ຢູ່ນີ້ · ຫຼາຍໃບ ⇒ ຢູ່ໃນຕາຕະລາງ "ແຍກຕາມໃບເບີກ" ລຸ່ມນີ້
          * (ບໍ່ດັ່ງນັ້ນຄົນບອກບໍ່ໄດ້ວ່າຄືນຈາກໃບເບີກໃບໃດ).
          */}
        {withdrawal && withdrawal.dispatches.length === 1 && withdrawal.dispatches[0].returns.length > 0 && (
          <div className="ml-5 border-l border-dashed border-brand-200">
            {withdrawal.dispatches[0].returns.map((doc) => (
              <ReturnBranch key={doc.doc_no} doc={doc} t={t} />
            ))}
          </div>
        )}

        {/**
          * **ແຍກຕາມໃບເບີກ** — ຂຶ້ນສະເພາະຕອນສາງຈ່າຍເປັນຫຼາຍໃບ (ໃບດຽວ node ຂ້າງເທິງບອກຄົບແລ້ວ).
          * ຈັດເປັນ **ຕາຕະລາງ** ບໍ່ແມ່ນລາຍການລອຍ: 4 ຄໍລຳຄົງທີ່ (ໃບ · ວັນທີ · ຜູ້ເບີກ · ລາຍການ)
          * ⇒ ຕາໄລ່ລົງລຸ່ມທຽບໃບຕໍ່ໃບໄດ້ ບໍ່ຕ້ອງອ່ານເປັນຫຍໍ້ໜ້າ.
          * ໃບທີ່**ບໍ່ມີລາຍການ**ຕິດປ້າຍເຫຼືອງ — ນັ້ນຄືຄວາມຜິດປົກກະຕິທີ່ຄວນເຫັນ ບໍ່ແມ່ນເລື່ອງທຳມະດາ.
          */}
        {withdrawal && withdrawal.dispatches.length > 1 && (
          <div className="ml-6 mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <PackageCheck className="size-3 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-600">
                {fill(t.byDispatch, { n: withdrawal.dispatches.length })}
              </span>
            </div>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-400">
                  {url.returnJobType && <th className="px-2.5 py-1" />}
                  <th className="px-2.5 py-1 font-medium">{t.colDispatch}</th>
                  <th className="px-2.5 py-1 font-medium">{t.colDate}</th>
                  <th className="px-2.5 py-1 font-medium">{t.colBy}</th>
                  <th className="px-2.5 py-1 font-medium">{t.colItems}</th>
                </tr>
              </thead>
              <tbody>
                {withdrawal.dispatches.map((dispatch) => (
                  <tr key={dispatch.doc_no} className="border-b border-slate-50 last:border-b-0 align-top">
                    {url.returnJobType && (
                      <td className="whitespace-nowrap px-2.5 py-1.5 text-right">
                        {dispatch.items.length > 0 && dispatch.returns.length === 0 && (
                          <ReturnRequestButton
                            docNo={dispatch.doc_no}
                            jobType={url.returnJobType}
                            size="sm"
                          />
                        )}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-2.5 py-1.5 font-mono font-bold text-brand-800">
                      {dispatch.doc_no}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-500">{dispatch.doc_date ?? "-"}</td>
                    <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-600">{dispatch.user_created ?? "-"}</td>
                    <td className="px-2.5 py-1.5">
                      {dispatch.items.length === 0 ? (
                        <span className="rounded bg-brand-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-orange-700">
                          {t.emptyDoc}
                        </span>
                      ) : (
                        <ul className="space-y-0.5">
                          {dispatch.items.map((item) => (
                            <li key={`${dispatch.doc_no}-${item.item_code}`} className="text-slate-700">
                              {item.item_name || item.item_code}
                              <span className="ml-1.5 font-semibold tabular-nums text-slate-500">×{item.qty}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {/* ຄືນຈາກໃບເບີກ**ໃບນີ້** — ຢູ່ໃນແຖວດຽວກັນ ຄົນຈຶ່ງບອກໄດ້ວ່າຄືນຂອງໃບໃດ */}
                      <ReturnLines returns={dispatch.returns} t={t} />
                    </td>
                    {/* ຂໍຄືນ **ສະເພາະໃບນີ້** — ໃບຫວ່າງ ຫຼື ຂໍຄືນໄປແລ້ວ ບໍ່ໂຊ້ວປຸ່ມ */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ຊ່າງກົດຮັບ — ຝັ່ງສ້ອມຖອດຂັ້ນນີ້ອອກແລ້ວ (ສາງເບີກແລ້ວ = ຜ່ານ) */}
        {techReceipt && withdrawal && (
          <Node
            icon={<Wrench className="size-3.5" />}
            tone={withdrawal.pick_no ? "text-brand-800" : "text-slate-300"}
            title={t.techNode}
            docNo={withdrawal.pick_no}
            docDate={withdrawal.pick_date}
            pending={jobStarted ? t.notSigned : t.waitTechSign}
            pendingTone={jobStarted ? "bg-slate-100 text-slate-500" : undefined}
            items={withdrawal.pick_items}
            against={withdrawal.pick_items.length > 0 ? withdrawal.dispatch_items : undefined}
            againstLabel={t.againstDispatched}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

/**
 * **ໃບຂໍຄືນ 1 ໃບ ເປັນງ່າ** — ຂໍຄືນ (SRI) ແລ້ວລົງອີກຂັ້ນເປັນ "ສາງຮັບຄືນ" (SRT/RIM).
 *
 * ຂັ້ນຮັບຄືນເປັນຂັ້ນທີ່**ຄ້າງໄດ້**: ຊ່າງກົດຂໍຄືນແລ້ວ ແຕ່ຖ້າສາງຍັງບໍ່ຮັບເຂົ້າ ຂອງຍັງຄາຢູ່ມືຊ່າງ
 * ແລະ ສະຕັອກຍັງບໍ່ຄືນ ⇒ ຕ້ອງເຫັນປ້າຍ "ລໍສາງຮັບຄືນ" ບໍ່ແມ່ນເຫັນແຕ່ວ່າ "ຂໍຄືນແລ້ວ".
 */
function ReturnBranch({ doc, t }: { doc: ReturnDoc; t: T }) {
  return (
    <div>
      <Node
        icon={<Undo2 className="size-3.5" />}
        tone="text-brand-orange-700"
        title={t.returnNode}
        docNo={doc.doc_no}
        docDate={doc.doc_date}
        pending="—"
        items={doc.items}
        t={t}
      />
      <div className="ml-5 border-l border-slate-200">
        <Node
          icon={<PackageCheck className="size-3.5" />}
          tone={doc.receive_no ? "text-brand-800" : "text-slate-300"}
          title={t.receiveReturnNode}
          docNo={doc.receive_no}
          docDate={doc.receive_date}
          pending={t.waitReceiveReturn}
          t={t}
        />
      </div>
    </div>
  );
}

/** ຮູບແບບແໜ້ນຂອງງ່າຂໍຄືນ — ໃຊ້ໃນຊ່ອງຕາຕະລາງ "ແຍກຕາມໃບເບີກ" (ບ່ອນແຄບ ວາງ tree ບໍ່ໄດ້) */
function ReturnLines({ returns, t }: { returns: ReturnDoc[]; t: T }) {
  if (returns.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 border-t border-dashed border-slate-200 pt-1">
      {returns.map((doc) => (
        <li key={doc.doc_no} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <Undo2 className="size-3 text-brand-orange-700" />
          <span className="text-[10px] text-slate-500">{t.returnShort}</span>
          <span className="font-mono text-[10px] font-semibold text-slate-700">{doc.doc_no}</span>
          {doc.doc_date && <span className="text-[10px] text-slate-400">{doc.doc_date}</span>}
          <span className="text-[10px] text-slate-500">
            {doc.items.map((item) => `${item.item_name || item.item_code} ×${item.qty}`).join(" · ")}
          </span>
          {doc.receive_no ? (
            <span className="text-[10px] text-brand-800">
              {t.receivedBack} <span className="font-mono font-semibold">{doc.receive_no}</span>
              {doc.receive_date && <span className="ml-1 text-slate-400">{doc.receive_date}</span>}
            </span>
          ) : (
            <span className="rounded bg-brand-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-900">
              {t.waitReceiveReturn}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** ງ່າຂໍຊື້ + ຕ່ອງໂສ້ ERP ຂອງມັນ (ລົງອີກຊັ້ນ) */
function PurchaseBranch({ buy, chain, t }: { buy: PurchaseRound; chain?: ErpChain; t: T }) {
  const state = PURCHASE_STATE[buy.state];
  const label = { waiting_approve: t.purchaseWaiting, approved: t.purchaseApproved, rejected: t.purchaseRejected }[buy.state];
  return (
    <div>
      <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 pl-5">
        <Elbow />
        <ShoppingCart className="size-3.5 text-brand-600" />
        <span className="font-mono text-[11px] font-semibold text-slate-700">{buy.doc_no}</span>
        {buy.doc_date && <span className="text-[11px] text-slate-500">{buy.doc_date}</span>}
        {/* ຄຳຈາກ dictionary · ສີຈາກ PURCHASE_STATE (ຄ່າຄົງທີ່ເຫຼືອໜ້າທີ່ບອກສີເທົ່ານັ້ນ) */}
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${state.tone}`}>{label}</span>
      </div>
      {/* ຕ່ອງໂສ້ຝັ່ງ ERP — ຢູ່ໃຕ້ໃບຂໍຊື້ທີ່ເປັນເຈົ້າຂອງມັນ. ແຕ່ລະຂັ້ນທຽບກັບຂັ້ນກ່ອນໜ້າ ⇒ ຫຼຸດ/ເກີນ = ແດງ */}
      <div className="ml-5 border-l border-dashed border-brand-200">
        {chain?.mismatch && (
          <p className="ml-5 mt-1 rounded bg-brand-orange-50 px-2 py-1 text-[10px] font-semibold text-brand-orange-700">
            {t.erpMismatch}
          </p>
        )}
        <Node
          icon={<Dot />}
          tone="text-brand-600"
          title={t.sprNode}
          docNo={chain?.spr_no ?? null}
          docDate={chain?.spr_date ?? null}
          pending={t.waitSpr}
          items={chain?.spr_items}
          against={chain?.spr_no && !chain.mismatch ? buy.items : undefined}
          againstLabel={t.againstPurchase}
          t={t}
        />
        <Node
          icon={<Dot />}
          tone="text-brand-600"
          title={t.approveNode}
          docNo={chain?.approve_no ?? null}
          docDate={chain?.approve_date ?? null}
          pending={t.waitApprove}
          items={chain?.approve_items}
          against={chain?.approve_no ? chain.spr_items : undefined}
          againstLabel={t.againstSpr}
          t={t}
        />
        <Node
          icon={<Dot />}
          tone="text-brand-600"
          title={t.orderNode}
          docNo={chain?.order_no ?? null}
          docDate={chain?.order_date ?? null}
          pending={t.waitOrder}
          items={chain?.order_items}
          against={chain?.order_no ? chain.approve_items : undefined}
          againstLabel={t.againstApprove}
          t={t}
        />
        <Node
          icon={<CheckCircle2 className="size-3.5" />}
          tone={chain?.receipt_no ? "text-brand-800" : "text-slate-300"}
          title={t.receiptNode}
          docNo={chain?.receipt_no ?? null}
          docDate={chain?.receipt_date ?? null}
          pending={t.waitReceipt}
          items={chain?.receipt_items}
          against={chain?.receipt_no ? chain.order_items : undefined}
          againstLabel={t.againstOrder}
          t={t}
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
  pendingTone,
  action,
  items = [],
  against,
  againstLabel,
  t,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  docNo: string | null;
  docDate: string | null;
  pending: string;
  /** ສີປ້າຍ "ຄ້າງ" — ຄ່າຫວ່າງ = ເຫຼືອງ (ຕ້ອງລົງມື); ເທົາ = ຄ້າງແຕ່ເອກະສານ ບໍ່ຂວາງວຽກ */
  pendingTone?: string;
  action?: ReactNode;
  /** ລາຍການຂອງໃບນີ້ */
  items?: DocItem[];
  /** ລາຍການຂັ້ນກ່ອນໜ້າທີ່ເອົາມາທຽບ — ບໍ່ໃສ່ = ບໍ່ທຽບ */
  against?: DocItem[];
  againstLabel?: string;
  t: T;
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
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${pendingTone ?? "bg-brand-orange-100 text-brand-900"}`}>
            {pending}
          </span>
        )}
        {diff?.mismatch && (
          <span className="rounded bg-brand-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-orange-700">
            {fill(t.mismatchWith, { label: againstLabel ?? "" })}
          </span>
        )}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {(diff?.rows.length ?? 0) > 0 && (
        <div className="ml-5 border-l border-slate-200">
          {diff!.rows.map((row) => (
            <ItemLine key={row.item_code} item={row} expected={row.expected} t={t} />
          ))}
        </div>
      )}
      {!diff && items.length > 0 && (
        <div className="ml-5 border-l border-slate-200">
          {items.map((item) => (
            <ItemLine key={item.item_code} item={item} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

/** ລາຍການ + ຈຳນວນ; ຕ່າງຈາກຂັ້ນກ່ອນໜ້າ ⇒ ແດງ ພ້ອມບອກຈຳນວນທີ່ຄາດໄວ້ */
function ItemLine({ item, expected, t }: { item: DocItem; expected?: number; t: T }) {
  const off = expected !== undefined && expected !== item.qty;
  return (
    <div className="relative flex items-center gap-2 py-1 pl-5">
      <Elbow />
      <span
        className={`truncate text-[11px] ${off ? "font-semibold text-brand-orange-700" : "text-slate-600"}`}
        title={item.item_code}
      >
        {item.item_name || item.item_code}
      </span>
      <b className={`whitespace-nowrap text-[11px] ${off ? "text-brand-orange-700" : "text-slate-500"}`}>× {item.qty}</b>
      {off && (
        <span className="whitespace-nowrap rounded bg-brand-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-orange-700">
          {item.qty === 0 ? fill(t.missingQty, { n: expected ?? 0 }) : fill(t.shouldBe, { n: expected ?? 0 })}
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
