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

const OPEN_JOB = `a.return_complete is null and coalesce(a.status,0) <> 6 and ${NOT_MISSING}`;
const TRANS_PICK = 166;
const TRANS_RQ = 78;

type DocRow = {
  job: string;
  product: string | null;
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

const DONE: NodeState = { label: "ຮຽບຮ້ອຍ", next: null, tone: "bg-emerald-50 text-emerald-700", pending: false };

export default async function SpareTreePage() {
  const { rows } = await query<DocRow>(
    `select t.product_code job, a.name_1 product, c.name_1 customer, nullif(a.emp_code,'') tech,
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

  // ── ຮວມເປັນໃບງານ ──
  type Job = { job: string; product: string | null; customer: string | null; tech: string | null; docs: DocRow[] };
  const jobs = new Map<string, Job>();
  for (const row of rows) {
    const job =
      jobs.get(row.job) ?? { job: row.job, product: row.product, customer: row.customer, tech: row.tech, docs: [] };
    job.docs.push(row);
    jobs.set(row.job, job);
  }

  /** ລູກຂອງ node (SWC ຂອງ SIO · PISP ຂອງ SWC · RQ ຂອງ SIO) */
  const childrenOf = (docs: DocRow[], parent: string, flag: number) =>
    docs.filter((doc) => doc.flag === flag && doc.parent === parent);

  /** ສະຖານະ + ຜູ້ເຮັດຕໍ່ຂອງ 1 ຮອບຂໍເບີກ */
  function roundState(docs: DocRow[], sio: DocRow): NodeState {
    const swcs = childrenOf(docs, sio.doc_no, TRANS.DISPATCH);
    if (swcs.length > 0) {
      // ໃບຂໍເບີກໃບນີ້ **ຈົບໜ້າທີ່ຂອງມັນແລ້ວ** (ສາງຈ່າຍອອກແລ້ວ) — ຂັ້ນທີ່ຄ້າງເປັນເລື່ອງຂອງ
      // ໃບເບີກ (SWC) ⇒ ປ້າຍ "ລໍຊ່າງກົດຮັບ" ຕ້ອງຢູ່ແຖວ SWC ບໍ່ແມ່ນຢູ່ແຖວນີ້.
      const unpicked = swcs.filter((swc) => childrenOf(docs, swc.doc_no, TRANS_PICK).length === 0);
      return unpicked.length > 0
        ? { label: "ສາງເບີກອອກແລ້ວ", next: null, tone: "bg-slate-100 text-slate-600", pending: true }
        : DONE;
    }
    const rqs = childrenOf(docs, sio.doc_no, TRANS_RQ);
    if (rqs.length > 0) {
      // ຄືກັນ: ລາຍລະອຽດຂອງການຊື້ຢູ່ແຖວ RQ ຂ້າງລຸ່ມ — ແຖວນີ້ບອກແຕ່ວ່າ "ໄປທາງຊື້"
      return { label: "ສາງບໍ່ມີ — ໄປທາງສັ່ງຊື້", next: null, tone: "bg-slate-100 text-slate-600", pending: true };
    }
    return { label: "ລໍສາງເບີກ", next: "ສາງ", tone: "bg-amber-100 text-amber-800", pending: true };
  }

  const cards = [...jobs.values()]
    .map((job) => {
      const sios = job.docs.filter((doc) => doc.flag === TRANS.REQUEST);
      const rounds = sios.map((sio, index) => ({ sio, round: index + 1, state: roundState(job.docs, sio) }));
      const pending = rounds.filter((round) => round.state.pending);
      const oldest = pending.reduce((max, round) => Math.max(max, round.sio.age), 0);
      return { ...job, rounds, pending: pending.length, oldest };
    })
    .filter((card) => card.rounds.length > 0)
    .sort((a, b) => b.pending - a.pending || b.oldest - a.oldest);

  const waiting = cards.filter((card) => card.pending > 0);
  const days = (seconds: number) => Math.max(0, Math.floor(seconds / 86400));
  const ageTone = (d: number) =>
    d >= 30 ? "bg-red-100 text-red-700" : d >= 7 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600";

  return (
    <div className="w-full space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ອາໄຫຼ່ຕາມໃບງານ</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          {cards.length} ໃບງານ · ຄ້າງ {waiting.length} ໃບ — ກົດແຖວເພື່ອເປີດ <b>ຕົ້ນໄມ້ເອກະສານ</b> ຂອງໃບງານນັ້ນ ·{" "}
          <Link href="/manual/spares" className="font-semibold text-teal-700 hover:underline">
            ຄູ່ມືຂັ້ນຕອນອາໄຫຼ່
          </Link>
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          ໃບງານ · ຮອບອາໄຫຼ່ · ຄ້າງມາ
        </div>

        {cards.map((card) => (
          <details key={card.job} open={card.pending > 0} className="group border-b border-slate-100 last:border-0">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <ChevronRight className="size-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
              <Link
                href={`/repair/${encodeURIComponent(card.job)}`}
                className="w-16 shrink-0 font-bold text-blue-700 hover:underline"
              >
                {card.job}
              </Link>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-slate-800">{card.product || "-"}</span>
                <span className="block truncate text-[10px] text-slate-400">
                  {card.customer || "-"} {card.tech && `· ຊ່າງ ${card.tech}`}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-slate-500">
                {card.rounds.length} ຮອບ
                {card.pending > 0 && <b className="ml-1 text-amber-700">· ຄ້າງ {card.pending}</b>}
              </span>
              {card.pending > 0 && (
                <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold tabular-nums ${ageTone(days(card.oldest))}`}>
                  {days(card.oldest)} ມື້
                </span>
              )}
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
                        href={`/stock/requests/view/${encodeURIComponent(sio.doc_no)}`}
                        className="font-mono font-semibold text-teal-700 hover:underline"
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
                              {picks.length > 0 ? (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                                  ຊ່າງຮັບແລ້ວ · {picks.map((pick) => pick.doc_no).join(", ")}
                                </span>
                              ) : (
                                <>
                                  <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-800">
                                    ລໍຊ່າງກົດຮັບ · {days(swc.age)} ມື້
                                  </span>
                                  <span className="text-slate-500">→ ຊ່າງ</span>
                                </>
                              )}
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
                                  ? "bg-red-50 text-red-700"
                                  : "bg-violet-50 text-violet-700"
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
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                >
                  ເປີດໜ້າວຽກສ້ອມ
                  <LinkPending className="size-3" />
                </Link>
              </li>
            </ul>
          </details>
        ))}

        {cards.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-400">ບໍ່ມີໃບງານທີ່ມີອາໄຫຼ່ຄ້າງ</p>}
      </section>
    </div>
  );
}
