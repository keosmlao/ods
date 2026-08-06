import { Elapsed } from "@/components/elapsed";
import { LinkPending } from "@/components/link-pending";
import { PageTitle } from "@/components/ui";
import { query } from "@/lib/db";
import { elapsedTone } from "@/lib/elapsed-tone";
import { requireRoleOrRedirect } from "@/lib/guard";
import { warehouses } from "@/lib/erp-lookup";
import { STOCK_SIDE } from "@/lib/roles";
import { LINE_STATUS, REPAIR_WAREHOUSES, TRANS } from "@/lib/stock-constants";
import Link from "next/link";
import { NewTransferPanel } from "./new-transfer-panel";

/**
 * ຂໍໂອນອາໄຫຼ່ມາຫ້ອງສ້ອມ (ບໍ່ຜ່ານໃບຂໍເບີກ) — ໃບ trans_flag 124 = ຄຳຂໍ, ບໍ່ຕັດສະຕ໋ອກ.
 *
 * ── ອອກແບບໃໝ່ 06-08-2026 ──
 * ເມື່ອກ່ອນໜ້ານີ້ມີແຕ່ **ຟອມເປົ່າ** ⇒ ຄົນເປີດມາບໍ່ຮູ້ວ່າຂໍໄປແລ້ວແມ່ນຫຍັງ ຄ້າງຢູ່ຈັກໃບ
 * ⇒ ຂໍຊ້ຳ ຫຼື ລືມທວງສາງໃຫຍ່. ດຽວນີ້ **ລາຍການເປັນຫຼັກ** ສ່ວນຟອມຢູ່ຫຼັງປຸ່ມ "ເພີ່ມ".
 * ການຮັບຂອງທີ່ໂອນມາ ຍັງເຮັດຢູ່ /stock/transfers ຄືເກົ່າ (ບ່ອນນັ້ນເປັນເຈົ້າຂອງເລື່ອງຮັບ).
 */
export const dynamic = "force-dynamic";

/** ໃບຂອງໜ້ານີ້ = ຊຸດເລກ SFRK (saveRepairTransfer) — ບໍ່ແມ່ນໃບຂໍໂອນທີ່ຜູກກັບໃບຂໍເບີກ */
const OWN_DOCS = `a.trans_flag = $1 and a.doc_no like 'SFRK%'`;

type Row = {
  doc_no: string;
  doc_date: string | null;
  wh_code: string | null;
  remark: string | null;
  status: number;
  lines: number;
  qty: number;
  items: string | null;
  elapsed_seconds: number;
};

export default async function TransferToRepairPage() {
  await requireRoleOrRedirect(STOCK_SIDE);
  // ປາຍທາງ = ສະເພາະ 2 ສາງສ້ອມສູນບໍລິການ (1104/1206) — ດຶງຊື່ຈາກ ERP, ຮຽງຕາມ REPAIR_WAREHOUSES
  const all = await warehouses();
  const byCode = new Map(all.map((wh) => [wh.code, wh]));
  const whs = REPAIR_WAREHOUSES.map((code) => byCode.get(code) ?? { code, name: code });

  const rows = (
    await query<Row>(
      `select a.doc_no, to_char(a.doc_date,'DD-MM-YYYY') doc_date, nullif(a.wh_code,'') wh_code,
          nullif(a.remark,'') remark, coalesce(a.status,0)::int status,
          (select count(*) from ic_trans_detail d
            where d.doc_no = a.doc_no and d.trans_flag = a.trans_flag)::int lines,
          (select coalesce(sum(d.qty),0) from ic_trans_detail d
            where d.doc_no = a.doc_no and d.trans_flag = a.trans_flag)::float8 qty,
          (select string_agg(d.item_name, ' · ' order by d.roworder) from ic_trans_detail d
            where d.doc_no = a.doc_no and d.trans_flag = a.trans_flag) items,
          greatest(0, extract(epoch from
            (localtimestamp - coalesce(a.create_date_time_now, a.doc_date::timestamp))))::int elapsed_seconds
        from ic_trans a
       where ${OWN_DOCS}
       order by a.doc_no desc
       limit 50`,
      [TRANS.TRANSFER],
    )
  ).rows;

  const waiting = rows.filter((row) => row.status === LINE_STATUS.PENDING).length;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle sub="ໂອນ (ບໍ່ເບີກ) ຈາກສາງອາໄຫຼ່ → ສາງຫ້ອງສ້ອມ · ບໍ່ຕັດສະຕ໋ອກ">ຂໍໂອນອາໄຫຼ່ມາຫ້ອງສ້ອມ</PageTitle>
        <NewTransferPanel warehouses={whs} />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-bold text-slate-700">
            ໃບຂໍໂອນລ່າສຸດ <span className="text-xs font-normal text-slate-400">({rows.length})</span>
          </h2>
          {waiting > 0 && (
            <span className="rounded-full bg-brand-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-orange-700">
              ລໍຖ້າຂອງ {waiting} ໃບ
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-400">ຍັງບໍ່ມີໃບຂໍໂອນ — ກົດ “ເພີ່ມໃບຂໍໂອນ”</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">ເລກທີ</th>
                  <th className="px-3 py-2.5 font-semibold">ວັນທີ</th>
                  <th className="px-3 py-2.5 font-semibold">ສາງປາຍທາງ</th>
                  <th className="px-3 py-2.5 font-semibold">ອາໄຫຼ່</th>
                  <th className="px-3 py-2.5 text-center font-semibold">ຈຳນວນ</th>
                  <th className="px-3 py-2.5 font-semibold">ຄ້າງມາ</th>
                  <th className="px-3 py-2.5 font-semibold">ສະຖານະ</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const received = row.status !== LINE_STATUS.PENDING;
                  const tone = elapsedTone(row.elapsed_seconds);
                  return (
                    <tr key={row.doc_no} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 font-bold text-brand-700">{row.doc_no}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{row.doc_date ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                        {byCode.get(row.wh_code ?? "")?.name ?? row.wh_code ?? "-"}
                      </td>
                      <td className="max-w-72 truncate px-3 py-2.5 text-slate-600" title={row.items ?? ""}>
                        {row.items ?? "-"}
                        <span className="ml-1 text-[10px] text-slate-400">({row.lines})</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center tabular-nums text-slate-700">{row.qty}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {received ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <Elapsed
                            seconds={row.elapsed_seconds}
                            className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.chip}`}
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {received ? (
                          <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                            ຮັບຂອງແລ້ວ
                          </span>
                        ) : (
                          <span className="rounded bg-brand-orange-300 px-2 py-0.5 text-[11px] font-semibold text-brand-900">
                            ລໍສາງໃຫຍ່ໂອນ
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        {/* ຮັບຂອງ ແລະ ຕິດຕາມ ຢູ່ /stock/transfers ບ່ອນດຽວ — ຢ່າມີສອງທາງເຂົ້າ */}
                        <Link
                          href={`/stock/transfers?q=${encodeURIComponent(row.doc_no)}`}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-500 px-3 text-[11px] font-semibold text-white hover:bg-brand-600"
                        >
                          {received ? "ເບິ່ງ" : "ຕິດຕາມ / ຮັບຂອງ"}
                          <LinkPending className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
