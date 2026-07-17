import { ApprovePoButton } from "@/app/(app)/purchase-orders/approve-po-button";
import { LinkPending } from "@/components/link-pending";
import { queryOdg } from "@/lib/db";
import { ERP_PURCHASE } from "@/lib/stock-constants";
import { ArrowRight, CheckCheck, Clock } from "lucide-react";
import Link from "next/link";

/**
 * **ຄິວອະນຸມັດໃບສັ່ງຊື້ (WPOA)** — ດ່ານສຸດທ້າຍກ່ອນຜູ້ສະໜອງສົ່ງຂອງ.
 *
 * ── ເປັນຫຍັງມີໜ້ານີ້ (17-07-2026) ──
 * ເມື່ອກ່ອນປຸ່ມອະນຸມັດ PO ຢູ່ໃນ**ໜ້າລາຍການ PO** ຂອງຝ່າຍຈັດຊື້ ⇒ ຜູ້ອະນຸມັດຕ້ອງໄປໄລ່ຫາ
 * ເອງວ່າໃບໃດລໍຕົນ ທ່າມກາງໃບ 100+ ໃບ. ກຸ່ມ "ອະນຸມັດ" ຄືບ່ອນທີ່ຜູ້ອະນຸມັດເປີດ ⇒ ຄິວຢູ່ນີ້.
 * ປຸ່ມຢູ່ໜ້າລາຍການ PO ຍັງຢູ່ຄືເກົ່າ (ຈັດຊື້ເຫັນສະຖານະ) — ອັນນີ້ເປັນ**ຄິວ** ບໍ່ແມ່ນລາຍການ.
 *
 * ── ນັບແນວໃດ ──
 * ລໍອະນຸມັດ = PO ຂອງສາຍເຮົາ (ຈາກ SPR ຫຼື ອອກໂດຍກົງ) ທີ່ **ຍັງບໍ່ມີ WPOA**.
 * ⚠️ WPOA ຜູກ**ທາງຫົວໃບ** (`doc_ref`) ບໍ່ແມ່ນທາງແຖວ — ເບິ່ງໝາຍເຫດທີ່ lib/erp-purchase.
 */
export const dynamic = "force-dynamic";

/** ໃບເກົ່າ remark ເປັນເລກ RQ ຫຼື ຂໍ້ຄວາມ — ລິ້ງສະເພາະທີ່ເປັນລະຫັດວຽກແທ້ */
const isJobCode = (value: string | null): value is string => /^(\d+|INST-\w+)$/.test(value ?? "");

const branchName = (code: string | null) =>
  code === "05" ? "ໂອດ່ຽນໄທ" : code === "00" ? "ສຳນັກງານໃຫ່ຍ" : (code ?? "-");

type Props = { searchParams: Promise<{ tab?: string }> };

type Row = {
  doc_no: string;
  doc_date: string | null;
  age: number | null;
  spr: string | null;
  job: string | null;
  supplier: string | null;
  supplier_name: string | null;
  branch_code: string | null;
  total: string | null;
  items: number;
  wpoa: string | null;
  wpoa_date: string | null;
};

/** PO ຂອງສາຍງານເຮົາ: ຈາກໃບຂໍຊື້ຂອງວຽກສ້ອມ (SPR) ຫຼື ອອກໂດຍກົງ (ຊື້ຕຸນ) */
const OURS = `(
  exists (select 1 from ic_trans_detail d where d.doc_no=t.doc_no and d.trans_flag=$1
           and d.ref_doc_no in (select w.doc_no from ic_trans_detail w
                                 where w.trans_flag=$2 and w.ref_doc_no like 'SPR%'))
  or not exists (select 1 from ic_trans_detail x where x.doc_no=t.doc_no and x.trans_flag=$1
                  and coalesce(x.ref_doc_no,'') <> '')
)`;
/** ⚠️ WPOA ຜູກທາງຫົວໃບ — ແຖວຂອງມັນ ref_doc_no ຫວ່າງ 100% (15,240 ແຖວ) */
const WPOA_OF = `(select min(w.doc_no) from ic_trans w
  where w.trans_flag=$3 and split_part(trim(coalesce(w.doc_ref,'')),' ',1)=t.doc_no)`;

async function getRows(waiting: boolean): Promise<Row[]> {
  try {
    return (
      await queryOdg<Row>(
        `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
            (current_date - t.doc_date)::int age,
            (select split_part(trim(coalesce(w.doc_ref,'')),' ',1) from ic_trans w
              where w.trans_flag=$2 and w.doc_no in (
                select d2.ref_doc_no from ic_trans_detail d2 where d2.doc_no=t.doc_no and d2.trans_flag=$1)
              limit 1) spr,
            split_part(trim(coalesce(t.remark,'')),' ',1) job,
            t.cust_code supplier,
            (select s.name_1 from ap_supplier s where s.code=t.cust_code limit 1) supplier_name,
            t.branch_code,
            to_char(coalesce(t.total_amount,0),'FM999,999,999,990') total,
            (select count(distinct d.item_code) from ic_trans_detail d
              where d.doc_no=t.doc_no and d.trans_flag=$1)::int items,
            ${WPOA_OF} wpoa,
            (select to_char(min(w.doc_date),'DD-MM-YYYY') from ic_trans w
              where w.trans_flag=$3 and split_part(trim(coalesce(w.doc_ref,'')),' ',1)=t.doc_no) wpoa_date
          from ic_trans t
         where t.trans_flag=$1 and t.doc_date >= current_date - 365 and ${OURS}
           and ${WPOA_OF} is ${waiting ? "null" : "not null"}
         order by t.doc_date ${waiting ? "asc" : "desc"}, t.doc_no
         limit 200`,
        [ERP_PURCHASE.ORDER, ERP_PURCHASE.PR_APPROVE, ERP_PURCHASE.ORDER_APPROVE],
      )
    ).rows;
  } catch (error) {
    console.error("approvals/purchase-orders read failed", error);
    return [];
  }
}

/** ອາຍຸໃບ — ລໍອະນຸມັດດົນ = ຜູ້ສະໜອງລໍ = ຂອງມາຊ້າ */
function AgeBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-slate-300">-</span>;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
        days >= 14 ? "bg-red-100 text-red-700" : days >= 7 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      {days} ມື້
    </span>
  );
}

export default async function ApprovePurchaseOrdersPage({ searchParams }: Props) {
  const params = await searchParams;
  const tab = params.tab === "approved" ? "approved" : "waiting";
  const [rows, waitingCount] = await Promise.all([
    getRows(tab === "waiting"),
    tab === "waiting" ? Promise.resolve(0) : getRows(true).then((list) => list.length),
  ]);
  const counts = { waiting: tab === "waiting" ? rows.length : waitingCount, approved: tab === "approved" ? rows.length : 0 };

  const TABS = [
    { key: "waiting", label: "ລໍຖ້າອະນຸມັດໃບສັ່ງຊື້", icon: Clock, count: counts.waiting },
    { key: "approved", label: "ອະນຸມັດແລ້ວ", icon: CheckCheck, count: null as number | null },
  ] as const;

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-700">ອະນຸມັດໃບສັ່ງຊື້ (PO)</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ດ່ານສຸດທ້າຍກ່ອນຜູ້ສະໜອງສົ່ງຂອງ — ອະນຸມັດ = ອອກ WPOA ລົງ ERP · {rows.length} ໃບ
        </p>
      </div>

      <div className="flex w-fit overflow-hidden rounded-lg border border-slate-300 bg-white">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <Link
            key={key}
            href={key === "waiting" ? "/approvals/purchase-orders" : "/approvals/purchase-orders?tab=approved"}
            className={`inline-flex h-9 items-center gap-1.5 border-l border-slate-300 px-3 text-xs font-medium first:border-l-0 ${
              tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
            {count !== null && count > 0 && (
              <span className={`rounded px-1 text-[10px] font-bold ${tab === key ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                {count}
              </span>
            )}
            <LinkPending className="size-3" />
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2.5 font-semibold">ເລກໃບສັ່ງຊື້</th>
                <th className="px-3 py-2.5 font-semibold">ວັນທີ</th>
                <th className="px-3 py-2.5 font-semibold">{tab === "waiting" ? "ລໍມາແລ້ວ" : "ອາຍຸໃບ"}</th>
                <th className="px-3 py-2.5 font-semibold">ແຫຼ່ງທີ່ມາ</th>
                <th className="px-3 py-2.5 font-semibold">ຜູ້ສະໜອງ</th>
                <th className="px-3 py-2.5 font-semibold">ສາຂາ</th>
                <th className="px-3 py-2.5 text-right font-semibold">ລາຍການ</th>
                <th className="px-3 py-2.5 text-right font-semibold">ຍອດ</th>
                {tab === "approved" && <th className="px-3 py-2.5 font-semibold">ໃບອະນຸມັດ</th>}
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.doc_no} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-bold">
                    {/* ໜ້າເອກະສານຮັບເລກ PO ໂດຍກົງ — ໃບຂອງຕ່ອງໂສ້ SPR ມັນເດັ້ງໄປໜ້າ SPR ເອງ */}
                    <Link href={`/purchase-orders/${encodeURIComponent(row.doc_no)}`} className="text-[#0536a9] hover:underline">
                      {row.doc_no}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{row.doc_date ?? "-"}</td>
                  <td className="px-3 py-2.5">
                    <AgeBadge days={row.age} />
                  </td>
                  <td className="px-3 py-2.5">
                    {row.spr ? (
                      <span className="inline-flex flex-col items-start">
                        {isJobCode(row.job) ? (
                          <Link href={`/service/${row.job}`} className="font-medium text-[#0536a9] hover:underline">
                            ວຽກ {row.job}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-600">ໃບຂໍຊື້</span>
                        )}
                        <span className="font-mono text-[9px] text-slate-400">{row.spr}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">ອອກໂດຍກົງ</span>
                    )}
                  </td>
                  <td className="max-w-52 truncate px-3 py-2.5" title={row.supplier_name ?? ""}>
                    <span className="font-mono text-[10px] text-slate-400">{row.supplier ?? "-"}</span>{" "}
                    {row.supplier_name ?? ""}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{branchName(row.branch_code)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.items}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{row.total ?? "0"}</td>
                  {tab === "approved" && (
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="font-mono text-[10px] text-emerald-700">{row.wpoa}</span>
                      <span className="block text-[10px] text-slate-400">{row.wpoa_date}</span>
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-center">
                    {tab === "waiting" ? (
                      <ApprovePoButton poNo={row.doc_no} back="/approvals/purchase-orders" />
                    ) : (
                      <Link
                        href={`/purchase-orders/${encodeURIComponent(row.doc_no)}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        ເບິ່ງໃບ
                        <ArrowRight className="size-3.5" />
                        <LinkPending className="size-3" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="py-12 text-center text-xs text-slate-400">
            {tab === "waiting" ? "ບໍ່ມີໃບສັ່ງຊື້ລໍອະນຸມັດ" : "ຍັງບໍ່ມີໃບທີ່ອະນຸມັດແລ້ວ"}
          </p>
        )}
      </section>
    </div>
  );
}
