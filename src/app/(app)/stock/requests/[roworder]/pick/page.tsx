import { addSpareToRequest } from "@/app/actions/stock";
import { Button, Card, Empty, LinkButton, PageTitle, Table } from "@/components/ui";
import { query } from "@/lib/db";
import { ArrowLeft, Search } from "lucide-react";
import { notFound } from "next/navigation";

/** ods: stock.py /showspareitemforreg + templates/stock/list_spare_for_reg.html */

type Props = { params: Promise<{ roworder: string }>; searchParams: Promise<{ q?: string }> };

type Spare = {
  rnum: number;
  code: string;
  name_1: string | null;
  unit_code: string | null;
  balance_qty: number | null;
};

async function getSpares(q: string) {
  const sql = q
    ? `select row_number() over ()::int rnum, code, name_1, unit_code, balance_qty::int balance_qty
       from ic_inventory where code ilike $1 or name_1 ilike $1 or part_number ilike $1 limit 20`
    : `select row_number() over ()::int rnum, code, name_1, unit_code, balance_qty::int balance_qty
       from ic_inventory limit 20`;
  return (await query<Spare>(sql, q ? [`%${q}%`] : [])).rows;
}

export default async function PickSparePage({ params, searchParams }: Props) {
  const { roworder } = await params;
  const q = ((await searchParams).q ?? "").trim();

  const product = await query<{ code: string; label: string | null }>(
    `select code, name_1||'-'||sn label from tb_product where roworder = $1`,
    [roworder],
  );
  const target = product.rows[0];
  if (!target) notFound();

  const spares = await getSpares(q);

  return (
    <div className="w-full space-y-6">
      <PageTitle sub={target.label ?? undefined}>ເລືອກອາໄຫຼ່</PageTitle>

      <Card
        title="ລາຍການອາໄຫຼ່"
        actions={
          <LinkButton href={`/stock/requests/${roworder}`} tone="neutral">
            <ArrowLeft className="size-4" />
            ກັບຄືນ
          </LinkButton>
        }
      >
        <form className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-full max-w-sm items-center gap-2 rounded-lg border border-slate-300 px-3">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input name="q" defaultValue={q} placeholder="ຄົ້ນຫາ" className="w-full text-sm outline-none" />
          </div>
          <Button type="submit" tone="success">
            ຄົ້ນຫາ
          </Button>
        </form>

        {spares.length === 0 ? (
          <Empty />
        ) : (
          <Table head={["#", "ລະຫັດ", "ລາຍການ", "ຫົວໜ່ວຍ", "ຄົງເຫຼືອ", ""]} minWidth={800}>
            {spares.map((spare) => (
              <tr key={spare.code} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-3 text-center">{spare.rnum}</td>
                <td className="px-3 py-3">{spare.code}</td>
                <td className="px-3 py-3">{spare.name_1 ?? "-"}</td>
                <td className="px-3 py-3 text-center">{spare.unit_code ?? "-"}</td>
                <td className="px-3 py-3 text-center">{spare.balance_qty ?? 0}</td>
                <td className="px-3 py-3 text-center">
                  <form action={addSpareToRequest}>
                    <input type="hidden" name="roworder" value={roworder} />
                    <input type="hidden" name="product_code" value={target.code} />
                    <input type="hidden" name="code" value={spare.code} />
                    <input type="hidden" name="name_1" value={spare.name_1 ?? ""} />
                    <input type="hidden" name="unit_code" value={spare.unit_code ?? ""} />
                    <Button type="submit" className="h-8 px-4 text-xs">
                      ເລືອກ
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
