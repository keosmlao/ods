import type { RequestHead } from "@/components/stock/request-form";
import { BackLink } from "@/components/back-link";
import { RequestWorkspace } from "@/components/stock/request-workspace";
import type { SpareBalance, SpareLine } from "@/components/stock/spare-lines";
import type { Shelf, Warehouse } from "@/components/stock/wh-shelf-select";
import { Card, ErrorBox, Table } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query, queryOdg } from "@/lib/db";
import { docPrefix } from "@/lib/doc-no";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { TRANS } from "@/lib/stock-constants";
import { canViewAssignedJob } from "@/lib/scope";
import { getBalances } from "@/lib/stock-balance";
import { canAccess, roleOf } from "@/lib/roles";
import { ClipboardList, PackageOpen, ShoppingCart, TriangleAlert } from "lucide-react";
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
  const sql = `select rnum, item_code, item_name,
      greatest(0, standard_qty - requested_qty) qty,
      standard_qty, requested_qty,
      greatest(0, standard_qty - requested_qty) remaining_qty,
      pending_qty, unit_code, roworder,
      (standard_qty - requested_qty <= 0) requested
    from (
      select row_number() over (order by s.roworder)::int rnum, s.item_code, s.item_name, s.qty,
        s.qty standard_qty, s.unit_code, s.roworder,
        sum(s.qty) over (partition by s.item_code order by s.roworder
                         rows between unbounded preceding and current row) cum,
        greatest(0, least(s.qty,
          coalesce((select sum(case when d.trans_flag = $2 then d.qty else -d.qty end)
                  from ic_trans_detail d
                  where d.product_code = s.product_code and d.item_code = s.item_code
                    and d.trans_flag in ($2,$3)), 0)
          - (sum(s.qty) over (partition by s.item_code order by s.roworder
                              rows between unbounded preceding and current row) - s.qty)
        )) requested_qty
        ,coalesce((select sum(d.qty)
                   from ic_trans_detail d
                   where d.product_code=s.product_code and d.item_code=s.item_code
                     and d.trans_flag=$2 and coalesce(d.status,0)=0),0) pending_qty
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
  const t = (await getDictionary(await getLocale())).requestsRoworder;
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
  const purchaseNeeded = pending.filter((line) => {
    const stock = balances[line.item_code]?.total ?? 0;
    const freeStock = Math.max(0, stock - Number(line.pending_qty ?? 0));
    return freeStock < Number(line.qty);
  });
  const availableNow = pending.filter((line) => {
    const stock = balances[line.item_code]?.total ?? 0;
    return Math.max(0, stock - Number(line.pending_qty ?? 0)) > 0;
  });

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackLink fallback="/stock/requests" label={t.backToList} />
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-700 text-white shadow-sm">
              <PackageOpen className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{t.title} #{head.product_code}</h1>
              <p className="mt-0.5 text-xs text-slate-500">{t.subtitle}</p>
            </div>
          </div>
        </div>
        <span className="inline-flex h-9 items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 text-xs font-semibold text-brand-600">
          <ClipboardList className="size-4" />
          {t.pendingBadgePrefix} {pending.length} {t.items}
        </span>
      </div>

      {purchaseNeeded.length > 0 && (
        <section className="rounded-2xl border border-brand-orange-400 bg-brand-orange-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-brand-900">
                <TriangleAlert className="size-4" />
                {availableNow.length > 0
                  ? "ມີທັງລາຍການເບີກຈາກສາງ ແລະ ລາຍການຕ້ອງສັ່ງຊື້"
                  : t.purchaseTitle}
              </h2>
              <p className="mt-1 text-xs text-brand-900">
                {t.purchaseNeedPrefix} {purchaseNeeded.length} {t.purchaseNeedSuffix}
              </p>
              {availableNow.length > 0 && (
                <ol className="mt-2 space-y-1 text-xs text-brand-900">
                  <li><b>1.</b> ເລືອກສາງ ແລະບັນທຶກໃບຂໍເບີກສຳລັບຈຳນວນທີ່ມີກ່ອນ</li>
                  <li><b>2.</b> ກົດ “ຂໍສັ່ງຊື້” ເພື່ອອອກ SPR ສຳລັບສ່ວນທີ່ຂາດ</li>
                </ol>
              )}
            </div>
            {canPurchase ? (
              <Link href={`/purchase-requests/new/${encodeURIComponent(head.product_code)}/direct`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-orange-700 px-4 text-xs font-bold text-white hover:bg-brand-orange-700">
                <ShoppingCart className="size-4" /> {t.createPurchaseDoc}
              </Link>
            ) : (
              <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-900">{t.sentToPurchaseQueue}</span>
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
        /**
         * ── ບໍ່ພໍ **ບໍ່ແມ່ນ** ເຫດຫ້າມເບີກອີກ (28-07-2026) ──
         * ແຕ່ກ່ອນ `purchaseNeeded.length === 0` ປິດປຸ່ມບັນທຶກທັງໃບ ⇒ ຂາດອາໄຫຼ່ 1 ຕົວ
         * ກໍ່ເບີກຫຍັງບໍ່ໄດ້ເລີຍ ທັງທີ່ຕົວອື່ນມີພ້ອມ ແລະ ຕົວທີ່ຂາດກໍ່ອາດມີຢູ່ສາງອື່ນ.
         * ດຽວນີ້ເບີກ "ເທົ່າທີ່ສາງນີ້ມີ" ໄດ້ ສ່ວນທີ່ຍັງຄ້າງອອກໃບຈາກສາງອື່ນ (ຫຼື ສັ່ງຊື້).
         */
        canRequest={pending.length > 0}
      />

      {/* ຂໍໄປແລ້ວ — ສະແດງໄວ້ໃຫ້ຮູ້ ແຕ່ຈະບໍ່ເຂົ້າໃບໃໝ່ (ກັນສາງເບີກອາໄຫຼ່ຕົວດຽວກັນສອງເທື່ອ) */}
      {requested.length > 0 && (
        <Card title={`${t.requestedTitlePrefix} ${requested.length} ${t.requestedTitleSuffix}`}>
          <Table head={[t.colCode, t.colName, t.colQty, t.colUnit]} minWidth={700}>
            {requested.map((line) => (
              <tr key={line.roworder} className="border-b border-slate-100 text-slate-500">
                <td className="px-3 py-3">{line.item_code}</td>
                <td className="px-3 py-3">{line.item_name ?? "-"}</td>
                <td className="px-3 py-3 text-center">{Number(line.standard_qty ?? line.qty)}</td>
                <td className="px-3 py-3 text-center">{line.unit_code ?? "-"}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-xs text-slate-400">
            {t.requestedNote}
          </p>
        </Card>
      )}

      {lines.length === 0 && <ErrorBox>{t.emptyNoSpares}</ErrorBox>}

      {lines.length > 0 && pending.length === 0 && (
        <ErrorBox>{t.allRequested}</ErrorBox>
      )}
    </div>
  );
}
