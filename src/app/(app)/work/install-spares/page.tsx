import { LinkPending } from "@/components/link-pending";
import { query } from "@/lib/db";
import { NOT_MISSING } from "@/lib/stage";
import { TRANS } from "@/lib/stock-constants";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * **ອາໄຫຼ່ — ລາຍການໃບງານ + ຕົ້ນໄມ້ເອກະສານ**.
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
 */
export const dynamic = "force-dynamic";

/** ວຽກຕິດຕັ້ງທີ່ຍັງດຳເນີນຢູ່ — ບໍ່ຍົກເລີກ ແລະ ຍັງບໍ່ປິດງານ */
const OPEN_JOB = `a.cancel_date is null and a.job_finish is null`;
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

export default async function InstallSpareTreePage() {
  const { rows } = await query<DocRow>(
    `select t.product_code job, coalesce(nullif(a.item_name,''), nullif(a.pro_model,'')) product, nullif(a.pro_sn,'') sn, nullif(a.pro_brand,'') brand,
        c.name_1 customer, nullif(a.tech_code,'') tech,
        null::text warranty, null::text service_type,
        t.trans_flag flag, t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
        nullif(split_part(trim(coalesce(t.doc_ref,'')),' ',1),'') parent,
        coalesce(t.aprove_status,0)::int approve,
        (select coalesce(sum(d.qty),0) from ic_trans_detail d where d.doc_no = t.doc_no)::float8 qty,
        extract(epoch from (localtimestamp - t.doc_date))::int age
      from ic_trans t
      join ods_tb_install a on a.code = t.product_code
      left join ar_customer c on c.code = a.cust_code
     where t.trans_flag in (${TRANS.REQUEST}, ${TRANS.DISPATCH}, ${TRANS_PICK}, ${TRANS_RQ})
       and ${OPEN_JOB}
     order by t.doc_date, t.doc_no`,
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

  const cards = [...jobs.values()]
    .map((job) => {
      const sios = job.docs.filter((doc) => doc.flag === TRANS.REQUEST);
      const rounds = sios.map((sio, index) => ({ sio, round: index + 1, state: roundState(job.docs, sio) }));
      const pending = rounds.filter((round) => round.state.pending);
      const oldest = pending.reduce((max, round) => Math.max(max, round.sio.age), 0);
      return { ...job, rounds, pending: pending.length, oldest };
    })
    // ເບີກຄົບແລ້ວ ⇒ ວຽກໄປຢູ່ຄິວ 'ລໍຖ້າສ້ອມ' ແລ້ວ ບໍ່ຄວນຄ້າງຢູ່ໜ້ານີ້ອີກ (ກົດເກນ ①: ແຖວ = badge)
    .filter((card) => card.rounds.length > 0 && card.pending > 0)
    .sort((a, b) => b.pending - a.pending || b.oldest - a.oldest);

  const days = (seconds: number) => Math.max(0, Math.floor(seconds / 86400));
  const ageTone = (d: number) =>
    d >= 30 ? "bg-brand-orange-100 text-brand-orange-700" : d >= 7 ? "bg-brand-orange-300 text-brand-900" : "bg-slate-100 text-slate-600";

  return (
    <div className="w-full space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ອາໄຫຼ່ຕາມໃບງານຕິດຕັ້ງ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {cards.length} ໃບງານຄ້າງອາໄຫຼ່ — ກົດແຖວເພື່ອເປີດ <b>ຕົ້ນໄມ້ເອກະສານ</b> ຂອງໃບງານນັ້ນ ·{" "}
          <Link href="/manual/spares" className="font-semibold text-brand-800 hover:underline">
            ຄູ່ມືຂັ້ນຕອນອາໄຫຼ່
          </Link>
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ຫົວຖັນ — ໃຊ້ຊຸດດຽວກັບຄິວ /work/<ຂັ້ນ> ອື່ນ (ພື້ນເທົາ · ເສັ້ນລຸ່ມ · ໜາ) */}
        <div className="overflow-x-auto">
          <div className="min-w-[1250px]">
            <div className="grid grid-cols-[4.5rem_5rem_minmax(0,1.4fr)_7rem_minmax(0,1.2fr)_6rem_6rem_6rem_4rem_9rem] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600">
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

        {cards.map((card) => (
          <details key={card.job} open={card.pending > 0} className="group border-b border-slate-100 last:border-0">
            <summary className="grid grid-cols-[4.5rem_5rem_minmax(0,1.4fr)_7rem_minmax(0,1.2fr)_6rem_6rem_6rem_4rem_9rem] items-center gap-3 cursor-pointer list-none px-4 py-2.5 text-xs hover:bg-slate-50">
              <span className="flex items-center gap-1.5">
                <ChevronRight className="size-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                <Link
                  href={`/installations/${encodeURIComponent(card.job)}`}
                  className="font-bold text-brand-700 hover:underline"
                >
                  {card.job}
                </Link>
              </span>
              <span className="text-center">
                {card.pending > 0 ? (
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold tabular-nums ${ageTone(days(card.oldest))}`}>
                    {days(card.oldest)} ມື້
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
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
              <span className="text-center tabular-nums text-slate-600">{card.rounds.length}</span>
              <span>
                {card.pending > 0 ? (
                  <span className="rounded bg-brand-orange-300 px-2 py-0.5 text-[11px] font-semibold text-brand-900">
                    ຄ້າງ {card.pending} ຮອບ
                  </span>
                ) : (
                  <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">ຄົບແລ້ວ</span>
                )}
              </span>
            </summary>

            {/* ── ຕົ້ນໄມ້ເອກະສານຂອງໃບງານນີ້ ── */}
            <ul className="ml-8 space-y-2 border-l border-slate-200 py-2 pl-4 pr-4 text-xs">
              {card.rounds.map(({ sio, round, state }) => {
                const swcs = childrenOf(card.docs, sio.doc_no, TRANS.DISPATCH);
                const rqs = childrenOf(card.docs, sio.doc_no, TRANS_RQ);
                return (
                  <li key={sio.doc_no} className="relative before:absolute before:-left-4 before:top-[0.85em] before:h-px before:w-4 before:bg-slate-300">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-500">ຮອບ {round}</span>
                      <Link
                        href={`/installations/spare-requests/view/${encodeURIComponent(sio.doc_no)}`}
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
                  href={`/installations/${encodeURIComponent(card.job)}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                >
                  ເປີດໜ້າວຽກສ້ອມ
                  <LinkPending className="size-3" />
                </Link>
              </li>
            </ul>
          </details>
        ))}

            {cards.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-slate-400">ບໍ່ມີໃບງານຕິດຕັ້ງທີ່ມີອາໄຫຼ່ຄ້າງ</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
