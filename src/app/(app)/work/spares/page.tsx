import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { NOT_MISSING, STAGE_SQL } from "@/lib/stage";
import { TRANS } from "@/lib/stock-constants";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";

/**
 * **ອາໄຫຼ່ — ລາຍການໃບງານ + ຕົ້ນໄມ້ເອກະສານ** (ອອກແບບໃໝ່ 04-08-2026).
 *
 * ໃບງານໜຶ່ງ = ແຖວດຽວ; ກົດຂະຫຍາຍແລ້ວເຫັນ**ຕົ້ນໄມ້ເອກະສານຂອງມັນ**ຕາມຄວາມຈິງ:
 *
 *   ຮອບ 1 · SIO (ຂໍເບີກ)
 *     └ SWC (ສາງເບີກ) → PISP (ຊ່າງຮັບ)
 *   ຮອບ 2 · SIO (ຂໍເບີກ) — ສາງບໍ່ມີ
 *     └ RQ (ຂໍຊື້) → ອະນຸມັດ → ຂອງເຂົ້າສາງ
 *
 * ⇒ ເບິ່ງແຖວດຽວຮູ້ວ່າ **ຮອບໃດຄ້າງຢູ່ຂັ້ນໃດ ແລະ ໃຜຕ້ອງລົງມື** ໂດຍບໍ່ຕ້ອງເປີດ 6 ໜ້າ.
 * ໃຊ້ `<details>` ⇒ ບໍ່ຕ້ອງມີ JS ຝັ່ງ client.
 *
 * ສະບັບໃໝ່ເພີ່ມ: ບັດ KPI · ຄົ້ນຫາ (?q) · ຕົວກອງສະຖານະ (?st) — ທຸກຢ່າງຢູ່ server
 * ຜ່ານ searchParams ບໍ່ມີ client JS. ຕຳແໜ່ງ/ຄິວ/ກົດເກນນັບຄ້າງຄືເກົ່າທຸກປະການ.
 */
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; st?: string }> };

const OPEN_JOB = `a.return_complete is null and coalesce(a.status,0) <> 6 and ${NOT_MISSING}`;
const TRANS_PICK = 166;
const TRANS_RQ = 78;

type DocRow = {
  job: string;
  product: string | null;
  sn: string | null;
  brand: string | null;
  warranty: string | null;
  service_type: string | null;
  customer: string | null;
  tech: string | null;
  flag: number;
  doc_no: string;
  doc_date: string | null;
  parent: string | null;
  approve: number;
  qty: number;
  age: number;
};

/** ສະຖານະຂອງແຕ່ລະ node — ຄຳເວົ້າ + ໃຜຕ້ອງລົງມືຕໍ່ + ສີ */
type NodeState = { label: string; next: string | null; tone: string; pending: boolean };

const DONE: NodeState = { label: "ຮຽບຮ້ອຍ", next: null, tone: "bg-brand-50 text-brand-800", pending: false };

/** ກຸ່ມສະຖານະຂອງໃບງານ — ໃຊ້ເປັນຕົວກອງ (?st=) ແລະ ຕົວເລກໃນບັດ KPI */
const STATUS = {
  not_requested: { label: "ຍັງບໍ່ອອກໃບຂໍເບີກ" },
  wait_stock: { label: "ລໍສາງເບີກ" },
  purchase: { label: "ໄປທາງສັ່ງຊື້" },
} as const;
type StatusKey = keyof typeof STATUS;

export default async function SpareTreePage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();
  const rawSt = params.st ?? "";
  const st: StatusKey | "" = rawSt in STATUS ? (rawSt as StatusKey) : "";

  const { rows } = await query<DocRow>(
    `select t.product_code job, a.name_1 product, nullif(a.sn,'') sn, nullif(a.p_brand,'') brand,
        c.name_1 customer, nullif(a.emp_code,'') tech,
        nullif(a.warrunty,'') warranty, nullif(a.service_type,'') service_type,
        t.trans_flag flag, t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
        nullif(split_part(trim(coalesce(t.doc_ref,'')),' ',1),'') parent,
        coalesce(t.aprove_status,0)::int approve,
        (select coalesce(sum(d.qty),0) from ic_trans_detail d where d.doc_no = t.doc_no)::float8 qty,
        extract(epoch from (localtimestamp - t.doc_date))::int age
      from ic_trans t
      join tb_product a on a.code = t.product_code
      left join ar_customer c on c.code = a.cust_code
     where t.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}, ${TRANS_PICK}, ${TRANS_RQ})
       and ${OPEN_JOB}
     order by t.doc_date, t.doc_no`,
  );

  /**
   * ── ວຽກທີ່ **ຍັງບໍ່ທັນອອກໃບຂໍເບີກ** (ຂັ້ນ 5 ກວດ Stock / ດຳເນີນອາໄຫຼ່) ──
   * ໜ້ານີ້ນັບຈາກ**ເອກະສານ** ⇒ ວຽກທີ່ຍັງບໍ່ມີເອກະສານຈັກໃບຈະຕົກຫາຍທັງທີ່**ຄ້າງແທ້**
   * (ວັດ 04-08-2026: 4 ໃບ — ນີ້ຄືຊ່ອງຫວ່າງ 4 ທີ່ຄົນໃຊ້ພົບລະຫວ່າງ dashboard ກັບເມນູ).
   * ດຶງມາເພີ່ມເປັນ "ຮອບ 0" ⇒ ເຫັນ ແລະ ກົດເຂົ້າໄປອອກໃບຂໍເບີກໄດ້.
   */
  const { rows: notYet } = await query<{
    job: string; product: string | null; sn: string | null; brand: string | null;
    customer: string | null; tech: string | null; warranty: string | null;
    service_type: string | null; age: number;
  }>(
    `select a.code job, a.name_1 product, nullif(a.sn,'') sn, nullif(a.p_brand,'') brand,
        c.name_1 customer, nullif(a.emp_code,'') tech,
        nullif(a.warrunty,'') warranty, nullif(a.service_type,'') service_type,
        extract(epoch from (localtimestamp - coalesce(a.time_finish_check, a.time_register)))::int age
      from tb_product a
      left join ar_customer c on c.code = a.cust_code
     where coalesce(a.used_spare,0) = 1 and ${OPEN_JOB}
       -- ⚠️ ຕ້ອງເປັນ **ຂັ້ນ 5 ເທົ່ານັ້ນ** — ບໍ່ດັ່ງນັ້ນວຽກທີ່ຍັງຢູ່ຂັ້ນສະເໜີລາຄາ (3/4)
       -- ຈະຖືກດຶງມາຄືກັນ (ພົບໃບ 7494) ທັງທີ່ຍັງບໍ່ຮອດຂັ້ນອາໄຫຼ່
       and (${STAGE_SQL}) = 5
       and not exists (select 1 from ic_trans t where t.trans_flag = ${TRANS.REQUEST} and t.product_code = a.code)
     order by age desc`,
  );

  // ── ຮວມເປັນໃບງານ ──
  type Job = Pick<DocRow, "product" | "sn" | "brand" | "customer" | "tech" | "warranty" | "service_type"> & {
    job: string;
    docs: DocRow[];
  };
  const jobs = new Map<string, Job>();
  for (const row of rows) {
    const job =
      jobs.get(row.job) ?? {
        job: row.job,
        product: row.product,
        sn: row.sn,
        brand: row.brand,
        customer: row.customer,
        tech: row.tech,
        warranty: row.warranty,
        service_type: row.service_type,
        docs: [],
      };
    job.docs.push(row);
    jobs.set(row.job, job);
  }

  /** ລູກຂອງ node (SWC ຂອງ SIO · PISP ຂອງ SWC · RQ ຂອງ SIO) */
  const childrenOf = (docs: DocRow[], parent: string, flag: number) =>
    docs.filter((doc) => doc.flag === flag && doc.parent === parent);

  /** ສະຖານະ + ຜູ້ເຮັດຕໍ່ຂອງ 1 ຮອບຂໍເບີກ */
  function roundState(docs: DocRow[], sio: DocRow): NodeState {
    const swcs = childrenOf(docs, sio.doc_no, TRANS.DISPATCH);
    // **ສາງເບີກແລ້ວ = ຈົບ** (ຕັດສິນໃຈ 04-08-2026, ໜ້ານີ້ເປັນງານສ້ອມລ້ວນ — join tb_product).
    // ແຕ່ກ່ອນຍັງລໍໃບຮັບ (PISP) ຈຶ່ງນັບຈົບ ⇒ ວຽກຄ້າງຄິວດົນເປັນ 76 ມື້ ທັງໆທີ່ຂອງໄປຮອດຊ່າງແລ້ວ.
    if (swcs.length > 0) return DONE;
    const rqs = childrenOf(docs, sio.doc_no, TRANS_RQ);
    if (rqs.length > 0) {
      // ຄືກັນ: ລາຍລະອຽດຂອງການຊື້ຢູ່ແຖວ RQ ຂ້າງລຸ່ມ — ແຖວນີ້ບອກແຕ່ວ່າ "ໄປທາງຊື້"
      return { label: "ສາງບໍ່ມີ — ໄປທາງສັ່ງຊື້", next: null, tone: "bg-slate-100 text-slate-600", pending: true };
    }
    return { label: "ລໍສາງເບີກ", next: "ສາງ", tone: "bg-brand-orange-300 text-brand-900", pending: true };
  }

  /** ວຽກຍັງບໍ່ອອກໃບຂໍເບີກ = ຄ້າງ 1 "ຮອບ 0" ⇒ ນັບເຂົ້າຍອດຄ້າງ ແລະ ຂຶ້ນຄຽງກັນ */
  const pendingCards = notYet.map((job) => ({
    ...job,
    docs: [] as DocRow[],
    rounds: [] as { sio: DocRow; round: number; state: NodeState }[],
    pending: 1,
    oldest: job.age,
    status: "not_requested" as StatusKey,
  }));

  const cards = [...jobs.values()]
    .map((job) => {
      const sios = job.docs.filter((doc) => doc.flag === TRANS.REQUEST);
      const rounds = sios.map((sio, index) => ({ sio, round: index + 1, state: roundState(job.docs, sio) }));
      const pending = rounds.filter((round) => round.state.pending);
      const oldest = pending.reduce((max, round) => Math.max(max, round.sio.age), 0);
      // ຈັດກຸ່ມຕາມຮອບຄ້າງ — ມີ "ລໍສາງ" ແມ່ນໃສ່ກຸ່ມສາງກ່ອນ (ສາງຕ້ອງລົງມື), ບໍ່ດັ່ງນັ້ນ = ທາງຊື້
      const status: StatusKey = pending.some((round) => round.state.next === "ສາງ")
        ? "wait_stock"
        : "purchase";
      return { ...job, rounds, pending: pending.length, oldest, status };
    })
    // ເບີກຄົບແລ້ວ ⇒ ວຽກໄປຢູ່ຄິວ 'ລໍຖ້າສ້ອມ' ແລ້ວ ບໍ່ຄວນຄ້າງຢູ່ໜ້ານີ້ອີກ (ກົດເກນ ①: ແຖວ = badge)
    .filter((card) => card.rounds.length > 0 && card.pending > 0)
    .sort((a, b) => b.pending - a.pending || b.oldest - a.oldest);
  const allCards = [...pendingCards, ...cards].sort((a, b) => b.oldest - a.oldest);

  const days = (seconds: number) => Math.max(0, Math.floor(seconds / 86400));
  const ageTone = (d: number) =>
    d >= 30 ? "bg-brand-orange-100 text-brand-orange-700" : d >= 7 ? "bg-brand-orange-300 text-brand-900" : "bg-slate-100 text-slate-600";
  /** ເສັ້ນຂອບຊ້າຍຂອງແຖວ — ສີຕາມອາຍຸຄ້າງ ເຫັນໄວວ່າໃບໃດຮີບ */
  const accent = (d: number) => (d >= 30 ? "border-l-brand-orange-600" : d >= 7 ? "border-l-brand-orange-500" : "border-l-slate-300");

  // ── ຕົວເລກ KPI (ຄິດຈາກທັງໝົດ ກ່ອນກອງ/ຄົ້ນ) ──
  const countBy = (key: StatusKey) => allCards.filter((card) => card.status === key).length;
  const pendingRounds = allCards.reduce((sum, card) => sum + card.pending, 0);
  const oldestDays = allCards.reduce((max, card) => Math.max(max, days(card.oldest)), 0);

  // ── ກອງ + ຄົ້ນ (ຢູ່ server — ສະອາດບໍ່ຕ້ອງ JS ຝັ່ງ client) ──
  const matches = (card: (typeof allCards)[number]) =>
    !q ||
    [card.job, card.product, card.sn, card.customer, card.tech, card.brand]
      .some((value) => value?.toLowerCase().includes(q));
  const visible = allCards.filter((card) => (!st || card.status === st) && matches(card));

  const chipHref = (key: StatusKey | "") => {
    const parts = [key ? `st=${key}` : "", q ? `q=${encodeURIComponent(q)}` : ""].filter(Boolean);
    return `/work/spares${parts.length > 0 ? `?${parts.join("&")}` : ""}`;
  };
  const chip = (key: StatusKey | "", label: string, count: number) => {
    const active = st === key;
    return (
      <Link
        key={key || "all"}
        href={chipHref(key)}
        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
          active
            ? "border-brand-700 bg-brand-700 text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-800"
        }`}
      >
        {label} <span className="tabular-nums">{count}</span>
      </Link>
    );
  };

  return (
    <div className="w-full space-y-4 pb-10">
      {/* ── ຫົວ ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-700">ອາໄຫຼ່ຕາມໃບງານ</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            ກົດແຖວເພື່ອເປີດ <b>ຕົ້ນໄມ້ເອກະສານ</b> — ຮູ້ວ່າຮອບໃດຄ້າງຢູ່ຂັ້ນໃດ ແລະ ໃຜຕ້ອງລົງມື ·{" "}
            <Link href="/manual/spares" className="font-semibold text-brand-800 hover:underline">
              ຄູ່ມືຂັ້ນຕອນອາໄຫຼ່
            </Link>
          </p>
        </div>
        <form method="get" className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ຄົ້ນ: ເລກວຽກ / ລູກຄ້າ / ຊ່າງ / SN…"
            className="w-64 rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          {st && <input type="hidden" name="st" value={st} />}
        </form>
      </div>

      {/* ── ບັດ KPI ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-brand-orange-400 bg-brand-orange-100/60 p-4">
          <p className="text-[11px] font-semibold text-slate-500">ໃບງານຄ້າງອາໄຫຼ່</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-brand-900">{allCards.length}</p>
          <p className="text-xs text-slate-400">ຈາກ {pendingRounds} ຮອບຂໍເບີກທີ່ຍັງຄ້າງ</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-slate-500">ຍັງບໍ່ອອກໃບຂໍເບີກ</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">{countBy("not_requested")}</p>
          <p className="text-xs text-slate-400">ວຽກຂັ້ນ 5 ທີ່ຍັງບໍ່ມີໃບ SIO — ຕ້ອງອອກໃບກ່ອນ</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-slate-500">ລໍສາງເບີກ / ໄປທາງຊື້</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-700">
            {countBy("wait_stock")} <span className="text-sm font-semibold text-slate-400">/</span> {countBy("purchase")}
          </p>
          <p className="text-xs text-slate-400">ສາງຕ້ອງລົງມື / ຕິດຕາມຈັດຊື້</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-slate-500">ຄ້າງດົນສຸດ</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${oldestDays >= 30 ? "text-brand-orange-700" : oldestDays >= 7 ? "text-brand-900" : "text-slate-700"}`}>
            {oldestDays} ມື້
          </p>
          <p className="text-xs text-slate-400">ນັບຈາກວັນທີຄ້າງທີ່ເກົ່າສຸດໃນລາຍການ</p>
        </div>
      </div>

      {/* ── ຕົວກອງສະຖານະ ── */}
      <div className="flex flex-wrap items-center gap-2">
        {chip("", "ທັງໝົດ", allCards.length)}
        {chip("not_requested", STATUS.not_requested.label, countBy("not_requested"))}
        {chip("wait_stock", STATUS.wait_stock.label, countBy("wait_stock"))}
        {chip("purchase", STATUS.purchase.label, countBy("purchase"))}
        {q && (
          <span className="text-xs text-slate-400">
            ຄົ້ນ &quot;{q}&quot; — ໄດ້ {visible.length} ລາຍການ ·{" "}
            <Link href={chipHref(st)} className="text-brand-800 underline">
              ລ້າງຄຳຄົ້ນ
            </Link>
          </span>
        )}
      </div>

      {/* ── ລາຍການ ── */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[1250px]">
            <div className="grid grid-cols-[4.5rem_5rem_minmax(0,1.4fr)_7rem_minmax(0,1.2fr)_6rem_6rem_6rem_4rem_10rem] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
              <span>ເລກວຽກ</span>
              <span className="text-center">ຄ້າງມາ</span>
              <span>ສິນຄ້າ / SN</span>
              <span>ຍີ່ຫໍ້</span>
              <span>ລູກຄ້າ</span>
              <span>ປະກັນ</span>
              <span>ປະເພດບໍລິການ</span>
              <span>ຊ່າງ</span>
              <span className="text-center">ຮອບ</span>
              <span>ສະຖານະ</span>
            </div>

            {visible.map((card) => (
              <details key={card.job} open className={`group border-b border-l-4 border-slate-100 last:border-b-0 ${accent(days(card.oldest))}`}>
                <summary className="grid grid-cols-[4.5rem_5rem_minmax(0,1.4fr)_7rem_minmax(0,1.2fr)_6rem_6rem_6rem_4rem_10rem] items-center gap-3 cursor-pointer list-none px-4 py-2.5 text-xs hover:bg-slate-50">
                  <span className="flex items-center gap-1.5">
                    <ChevronRight className="size-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                    <Link
                      href={`/repair/${encodeURIComponent(card.job)}`}
                      className="font-bold text-brand-700 hover:underline"
                    >
                      {card.job}
                    </Link>
                  </span>
                  <span className="text-center">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold tabular-nums ${ageTone(days(card.oldest))}`}>
                      {days(card.oldest)} ມື້
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-slate-800">
                    {card.product || "-"}
                    {card.sn && <span className="ml-1 text-[10px] text-slate-400">{card.sn}</span>}
                  </span>
                  <span className="truncate text-slate-600">{card.brand || "-"}</span>
                  <span className="truncate text-slate-600">{card.customer || "-"}</span>
                  <span className="truncate text-slate-600">{card.warranty || "-"}</span>
                  <span className="truncate text-slate-600">{card.service_type || "-"}</span>
                  <span className="truncate text-slate-600">{card.tech || "-"}</span>
                  <span className="text-center tabular-nums text-slate-600">{card.rounds.length || "—"}</span>
                  <span>
                    {card.status === "not_requested" ? (
                      <span className="rounded bg-brand-orange-50 px-2 py-0.5 text-[11px] font-semibold text-brand-orange-700">
                        {STATUS.not_requested.label}
                      </span>
                    ) : card.status === "wait_stock" ? (
                      <span className="rounded bg-brand-orange-300 px-2 py-0.5 text-[11px] font-semibold text-brand-900">
                        {STATUS.wait_stock.label} · ຄ້າງ {card.pending} ຮອບ
                      </span>
                    ) : (
                      <span className="rounded bg-brand-orange-50 px-2 py-0.5 text-[11px] font-semibold text-brand-orange-700">
                        {STATUS.purchase.label} · ຄ້າງ {card.pending} ຮອບ
                      </span>
                    )}
                  </span>
                </summary>

                {/* ── ຕົ້ນໄມ້ເອກະສານຂອງໃບງານນີ້ ── */}
                <ul className="ml-8 space-y-2 border-l border-slate-200 py-2 pl-4 pr-4 text-xs">
                  {card.status === "not_requested" && (
                    <li className="text-slate-500">
                      ວຽກນີ້ໝາຍ <b>ໃຊ້ໄດ້/ຕ້ອງໃຊ້ອາໄຫຼ່</b> ແລ້ວ ແຕ່ຍັງບໍ່ມີໃບຂໍເບີກ (SIO) — ເຂົ້າໜ້າວຽກເພື່ອອອກໃບຂໍເບີກ
                    </li>
                  )}
                  {card.rounds.map(({ sio, round, state }) => {
                    const swcs = childrenOf(card.docs, sio.doc_no, TRANS.DISPATCH);
                    const rqs = childrenOf(card.docs, sio.doc_no, TRANS_RQ);
                    return (
                      <li key={sio.doc_no} className="relative before:absolute before:-left-4 before:top-[0.85em] before:h-px before:w-4 before:bg-slate-300">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-500">ຮອບ {round}</span>
                          <Link
                            href={`/stock/requests/view/${encodeURIComponent(sio.doc_no)}`}
                            className="font-mono font-semibold text-brand-800 hover:underline"
                          >
                            {sio.doc_no}
                          </Link>
                          <span className="text-slate-400">
                            ຂໍເບີກ {sio.doc_date} · {sio.qty} ອັນ
                          </span>
                          <span className="ml-auto flex items-center gap-2">
                            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${state.tone}`}>{state.label}</span>
                            {state.next && <span className="text-[11px] text-slate-500">→ {state.next}</span>}
                          </span>
                        </div>

                        {/* ລູກ: ໃບເບີກ / ໃບຂໍຊື້ */}
                        <ul className="relative ml-2 mt-1 space-y-1 border-l border-slate-300 pl-4 text-[11px] text-slate-500">
                          {swcs.map((swc) => {
                            const picks = childrenOf(card.docs, swc.doc_no, TRANS_PICK);
                            return (
                              <li key={swc.doc_no} className="relative before:absolute before:-left-4 before:top-[0.85em] before:h-px before:w-4 before:bg-slate-300 flex flex-wrap items-center gap-2">
                                <span className="font-mono text-slate-600">{swc.doc_no}</span>
                                <span>ສາງເບີກ {swc.doc_date}</span>
                                <span className="ml-auto flex items-center gap-2">
                                  {/* ງານສ້ອມ: ສາງເບີກອອກ = ຈົບ — ບໍ່ລໍໃບຮັບ (PISP) ອີກແລ້ວ */}
                                  <span className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-800">
                                    {picks.length > 0
                                      ? `ຊ່າງຮັບແລ້ວ · ${picks.map((pick) => pick.doc_no).join(", ")}`
                                      : "ສາງເບີກອອກແລ້ວ"}
                                  </span>
                                </span>
                              </li>
                            );
                          })}
                          {rqs.map((rq) => (
                            <li key={rq.doc_no} className="relative before:absolute before:-left-4 before:top-[0.85em] before:h-px before:w-4 before:bg-slate-300 flex flex-wrap items-center gap-2">
                              <span className="font-mono text-slate-600">{rq.doc_no}</span>
                              <span>ຂໍຊື້ {rq.doc_date}</span>
                              <span className="ml-auto flex items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 font-semibold ${
                                    rq.approve === 1
                                      ? "bg-slate-100 text-slate-700"
                                      : rq.approve === 2
                                        ? "bg-brand-orange-50 text-brand-orange-700"
                                        : "bg-brand-orange-50 text-brand-orange-700"
                                  }`}
                                >
                                  {rq.approve === 1
                                    ? "ອະນຸມັດແລ້ວ — ຕິດຕາມຢູ່ ERP"
                                    : rq.approve === 2
                                      ? "ບໍ່ອະນຸມັດ"
                                      : `ລໍອະນຸມັດ · ${days(rq.age)} ມື້`}
                                </span>
                                {rq.approve !== 2 && (
                                  <span className="text-slate-500">→ {rq.approve === 1 ? "ຈັດຊື້" : "ຜູ້ຈັດການ"}</span>
                                )}
                              </span>
                            </li>
                          ))}
                          {swcs.length === 0 && rqs.length === 0 && (
                            <li className="relative text-slate-400 before:absolute before:-left-4 before:top-[0.85em] before:h-px before:w-4 before:bg-slate-300">ຍັງບໍ່ມີໃບເບີກ ຫຼື ໃບຂໍຊື້ຕໍ່ຈາກໃບນີ້</li>
                          )}
                        </ul>
                      </li>
                    );
                  })}

                  <li className="pt-1">
                    <Link
                      href={`/repair/${encodeURIComponent(card.job)}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                    >
                      ເປີດໜ້າວຽກສ້ອມ
                      <LinkPending className="size-3" />
                    </Link>
                  </li>
                </ul>
              </details>
            ))}

            {visible.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-slate-400">
                {allCards.length === 0
                  ? "ບໍ່ມີໃບງານທີ່ມີອາໄຫຼ່ຄ້າງ"
                  : `ບໍ່ພົບລາຍການທີ່ກົງກັບ${q ? `ຄຳຄົ້ນ "${q}"` : ""}${q && st ? " ແລະ ຕົວກອງນີ້" : st ? "ຕົວກອງນີ້" : ""}`}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
