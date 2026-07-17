import type { RequestHead } from "@/components/stock/request-form";
import { RequestWorkspace } from "@/components/stock/request-workspace";
import type { SpareBalance, SpareLine } from "@/components/stock/spare-lines";
import type { Shelf, Warehouse } from "@/components/stock/wh-shelf-select";
import { Card, ErrorBox, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { TRANS } from "@/lib/stock-constants";
import { canViewAssignedJob } from "@/lib/scope";
import { getBalances } from "@/lib/stock-balance";
import { canAccess, roleOf } from "@/lib/roles";
import { ArrowLeft, ClipboardList, PackageOpen, ShoppingCart, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

/** ods: stock.py /show_req/<roworder> + templates/stock/req_page.html */

type Props = { params: Promise<{ roworder: string }> };

/** ແຖວກະຕ່າ + ທຸງວ່າ "ຂໍໄປແລ້ວ" (ມີໃນໃບຂໍເບີກ 122 ແລ້ວ ແລະ ຍັງບໍ່ໄດ້ສົ່ງຄືນ) */
type Row = SpareLine & { requested: boolean };

async function getHead(roworder: string) {
  const sql = `select to_char(a.time_finish_check,'DD-MM-YYYY HH24:MI:SS') checked_at,
      concat_ws('-', b.name_1, b.tel) customer, concat_ws(' · ', a.name_1, a.sn) product,
      a.p_brand brand, a.warrunty warranty, a.issue, a.issue_2, a.emp_code technician, a.code product_code
    from tb_product a
    left join ar_customer b on b.code = a.cust_code
    where a.roworder = $1`;
  return (await query<RequestHead>(sql, [roworder])).rows[0] ?? null;
}

/**
 * ແຖວກະຕ່າ ພ້ອມ "ຈຳນວນທີ່ຖືກຂໍໄປແລ້ວ" ຂອງອາໄຫຼ່ຕົວນັ້ນ.
 * ໃບຂໍເບີກຈະເອົາສະເພາະ "ຈຳນວນທີ່ຍັງຄ້າງ" (qty - covered) ເທົ່ານັ້ນ
 * — ເບິ່ງ OUTSTANDING_SPARES ໃນ actions/stock.ts. ບ່ອນນີ້ສະແດງໃຫ້ຜູ້ໃຊ້ເຫັນວ່າ
 * ອັນໃດຈະຢູ່ໃນໃບ ອັນໃດຂໍໄປແລ້ວ ຈຶ່ງບໍ່ແປກໃຈຕອນໃບອອກມາສັ້ນກວ່າກະຕ່າ.
 */
async function getLines(productCode: string) {
  // ຈຳນວນສະສົມຂອງອາໄຫຼ່ຕົວດຽວກັນ (cum) ທຽບກັບຈຳນວນທີ່ຂໍໄປແລ້ວ (covered)
  // ⇒ ແຖວທີ່ຢູ່ພາຍໃນຈຳນວນທີ່ຂໍໄປແລ້ວ = "ຂໍໄປແລ້ວ" (ໃຊ້ໄດ້ເຖິງມີແຖວອາໄຫຼ່ຕົວດຽວກັນຫຼາຍແຖວ)
  const sql = `select rnum, item_code, item_name, qty, unit_code, roworder, (cum <= covered) requested
    from (
      select row_number() over (order by s.roworder)::int rnum, s.item_code, s.item_name, s.qty,
        s.unit_code, s.roworder,
        sum(s.qty) over (partition by s.item_code order by s.roworder
                         rows between unbounded preceding and current row) cum,
        coalesce((select sum(case when d.trans_flag = $2 then d.qty else -d.qty end)
                  from ic_trans_detail d
                  where d.product_code = s.product_code and d.item_code = s.item_code
                    and d.trans_flag in ($2,$3)), 0) covered
      from tb_used_spare s where s.product_code = $1
    ) t order by rnum`;
  return (await query<Row>(sql, [productCode, TRANS.REQUEST, TRANS.RETURN_REQUEST])).rows;
}

/** ຕົວຢ່າງເລກທີ — ເລກຈິງອອກຕອນບັນທຶກ (ພາຍໃນ transaction ທີ່ລັອກແລ້ວ) */
async function previewDocNo() {
  const prefix = docPrefix("SIO");
  const sql = `select coalesce(max(substring(doc_no from ${prefix.length + 1})::int), 0) + 1 seq
    from ic_trans where doc_no like $1 and substring(doc_no from ${prefix.length + 1}) ~ '^[0-9]+$'`;
  const seq = (await query<{ seq: number }>(sql, [`${prefix}%`])).rows[0]?.seq ?? 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * ສາງ/ທີ່ເກັບ — **ທຸກສາງ** (ນະໂຍບາຍ 16-07-2026: ສາງໃດມີ stock ເບີກໄດ້ໝົດ).
 * ແຕ່ກ່ອນຈຳກັດ 4 ສາງ (REQUEST_WAREHOUSES) ⇒ ຂອງຢູ່ສາງອື່ນ ເບີກກໍ່ບໍ່ໄດ້
 * ຊື້ກໍ່ບໍ່ໃຫ້ (ຂໍຊື້ນັບທຸກສາງ) — ວຽກຕັນສອງທາງ.
 */
async function getWarehouses() {
  const warehouses = await queryOdg<Warehouse>(
    `select code, name_1 from ic_warehouse order by code asc`,
  );
  const shelves = await queryOdg<Shelf>(
    `select code, name_1, whcode from ic_shelf order by code`,
  );
  return { warehouses: warehouses.rows, shelves: shelves.rows };
}

export default async function StockRequestFormPage({ params }: Props) {
  const { roworder } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const canPurchase = canAccess(roleOf(session), "/purchase-requests");

  const head = await getHead(roworder);
  if (!head) notFound();
  if (!canViewAssignedJob(session, head.technician)) redirect("/forbidden");

  const lines = await getLines(head.product_code);
  const [docNo, wh, balanceMap] = await Promise.all([
    previewDocNo(),
    getWarehouses(),
    getBalances(lines.map((line) => line.item_code)),
  ]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

  // ໃບນີ້ຈະມີແຕ່ແຖວທີ່ຍັງບໍ່ໄດ້ຂໍ — ອາໄຫຼ່ທີ່ຂໍ/ເບີກໄປແລ້ວ ບໍ່ຖືກຂໍຊ້ຳອີກ
  const pending = lines.filter((line) => !line.requested);
  const requested = lines.filter((line) => line.requested);
  const balances: Record<string, SpareBalance> = {};
  for (const line of lines) {
    const balance = balanceMap.get(line.item_code);
    balances[line.item_code] = {
      total: balance?.total ?? 0,
      byWarehouse: Object.fromEntries(balance?.byWarehouse ?? []),
      byLocation: Object.fromEntries(balance?.byLocation ?? []),
    };
  }
  const purchaseNeeded = pending.filter((line) => (balances[line.item_code]?.total ?? 0) < Number(line.qty));

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/stock/requests"
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700"
          >
            <ArrowLeft className="size-3.5" />
            ກັບໄປລາຍການຂໍເບີກ
          </Link>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-teal-600 text-white shadow-sm">
              <PackageOpen className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-800">ຂໍເບີກອາໄຫຼ່ #{head.product_code}</h1>
              <p className="mt-0.5 text-xs text-slate-500">ເລືອກສາງ · ກວດຍອດຄົງເຫຼືອ · ຢືນຢັນລາຍການກ່ອນສົ່ງຄຳຂໍ</p>
            </div>
          </div>
        </div>
        <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700">
          <ClipboardList className="size-4" />
          ລໍສົ່ງຄຳຂໍ {pending.length} ລາຍການ
        </span>
      </div>

      {purchaseNeeded.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <TriangleAlert className="size-4" /> ຕ້ອງສັ່ງຊື້ກ່ອນຂໍເບີກ
              </h2>
              <p className="mt-1 text-xs text-amber-800">
                ERP ບໍ່ມີ/ຈຳນວນບໍ່ພໍ {purchaseNeeded.length} ລາຍການ. ຫຼັງຮັບເຂົ້າສາງແລ້ວ ຈຶ່ງກັບມາສ້າງໃບຂໍເບີກ.
              </p>
            </div>
            {canPurchase ? (
              <Link href={`/purchase-requests/new/${encodeURIComponent(head.product_code)}/direct`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-bold text-white hover:bg-amber-700">
                <ShoppingCart className="size-4" /> ສ້າງໃບຂໍສັ່ງຊື້
              </Link>
            ) : (
              <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-amber-800">ສົ່ງເຂົ້າຄິວຝ່າຍຈັດຊື້ແລ້ວ</span>
            )}
          </div>
        </section>
      )}

      <RequestWorkspace
        head={head}
        docNo={docNo}
        today={today}
        warehouses={wh.warehouses}
        shelves={wh.shelves}
        lines={pending}
        roworder={roworder}
        balances={balances}
        canRequest={purchaseNeeded.length === 0}
      />

      {/* ຂໍໄປແລ້ວ — ສະແດງໄວ້ໃຫ້ຮູ້ ແຕ່ຈະບໍ່ເຂົ້າໃບໃໝ່ (ກັນສາງເບີກອາໄຫຼ່ຕົວດຽວກັນສອງເທື່ອ) */}
      {requested.length > 0 && (
        <Card title={`ຂໍເບີກໄປແລ້ວ ${requested.length} ລາຍການ (ຈະບໍ່ຖືກຂໍຊ້ຳ)`}>
          <Table head={["ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ"]} minWidth={700}>
            {requested.map((line) => (
              <tr key={line.roworder} className="border-b border-slate-100 text-slate-500">
                <td className="px-3 py-3">{line.item_code}</td>
                <td className="px-3 py-3">{line.item_name ?? "-"}</td>
                <td className="px-3 py-3 text-center">{Number(line.qty)}</td>
                <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-slate-400">
            ອາໄຫຼ່ທີ່ຢູ່ໃນໃບຂໍເບີກເກົ່າແລ້ວ ຈະບໍ່ຖືກເອົາເຂົ້າໃບໃໝ່ — ຕິດຕາມສະຖານະໄດ້ທີ່ໜ້າ &quot;ໃບຂໍເບີກອາໄຫຼ່&quot;
          </p>
        </Card>
      )}

      {lines.length === 0 && <ErrorBox>ຍັງບໍ່ມີອາໄຫຼ່ໃນລາຍການ — ກົດ &quot;ເລືອກ&quot; ເພື່ອເພີ່ມອາໄຫຼ່</ErrorBox>}

      {lines.length > 0 && pending.length === 0 && (
        <ErrorBox>ອາໄຫຼ່ທຸກລາຍການຂອງວຽກນີ້ ຖືກຂໍເບີກ ຫຼື ເບີກອອກໄປແລ້ວ — ຖ້າຕ້ອງການອາໄຫຼ່ເພີ່ມ ໃຫ້ກົດ &quot;ເລືອກ&quot;</ErrorBox>
      )}
    </div>
  );
}
