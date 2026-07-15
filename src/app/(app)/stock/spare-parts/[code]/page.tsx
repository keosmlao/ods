import { Card, Empty, PageTitle, Table } from "@/components/ui";
import { queryOdg } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * ໜ້າລາຍລະອຽດອາໄຫຼ່ — ຕອບຄຳຖາມ "ອາໄຫຼ່ຕົວນີ້ໃຊ້ກັບສິນຄ້າຫຍັງແດ່".
 *
 * ອ່ານ **ສົດຈາກ ERP (odg)** ທັງໝົດ — ຫົວອາໄຫຼ່, ຍອດຄົງເຫຼືອ ແລະ ສິນຄ້າທີ່ໃຊ້ຮ່ວມ
 * (odg_product_spare_mapping). ຍອດສາງໃຫຍ່ 1103 ຜ່ານ function ດຽວກັບໜ້າລາຍການ.
 * ERP ອ່ານຢ່າງດຽວ (SCHEMA-CHANGES.md) — ໜ້ານີ້ບໍ່ຂຽນຫຍັງລົງ ERP.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

type Spare = {
  code: string;
  name_1: string | null;
  name_2: string | null;
  unit_code: string | null;
  item_brand: string | null;
  balance_qty: number;
  wh_qty: number;
};

type Product = {
  product_code: string;
  name_1: string | null;
  name_2: string | null;
  item_brand: string | null;
  item_model: string | null;
};

async function getSpare(code: string) {
  const sql = `select i.code, i.name_1, i.name_2, i.unit_standard unit_code, i.item_brand,
      coalesce(i.balance_qty,0)::float8 balance_qty,
      coalesce((select round(balance_qty,2) from sml_ic_function_stock_balance_warehouse_location('2099-12-31', i.code, '1103', '') limit 1),0)::float8 wh_qty
    from ic_inventory i where i.code = $1`;
  return (await queryOdg<Spare>(sql, [code])).rows[0] ?? null;
}

/**
 * ສິນຄ້າທີ່ໃຊ້ອາໄຫຼ່ນີ້ — left join ໄວ້ ເພື່ອໃຫ້ລະຫັດທີ່ບໍ່ມີໃນ ERP ຍັງສະແດງອອກ.
 * ic_inventory ຂອງ ERP ບໍ່ມີ part_number/unit_code ຄື ODS — ຮຸ່ນຢູ່ item_model.
 */
async function getProducts(code: string) {
  const sql = `select m.product_code, p.name_1, p.name_2, p.item_brand, p.item_model
    from odg_product_spare_mapping m
    left join ic_inventory p on p.code = m.product_code
    where m.spare_code = $1
    order by m.product_code`;
  return (await queryOdg<Product>(sql, [code])).rows;
}

export default async function SparePartDetailPage({ params }: Props) {
  const { code } = await params;
  const spare = await getSpare(decodeURIComponent(code));
  if (!spare) notFound();

  const products = await getProducts(spare.code);
  const inStock = spare.balance_qty > 0;

  const FIELDS: { label: string; value: string }[] = [
    { label: "ຫຍີ່ຫໍ້", value: spare.item_brand || "-" },
    { label: "ຫົວໜ່ວຍ", value: spare.unit_code || "-" },
    { label: "ສາງໃຫຍ່ (1103)", value: spare.wh_qty.toLocaleString() },
  ];

  return (
    <div className="w-full space-y-4">
      <Link href="/stock/spare-parts" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-3.5" />
        ກັບຄືນລາຍການອາໄຫຼ່
      </Link>

      <PageTitle sub={spare.name_2 || undefined}>
        {spare.code} · {spare.name_1 || "-"}
      </PageTitle>

      <Card title="ຂໍ້ມູນອາໄຫຼ່">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">ຄົງເຫຼືອ</p>
            <p
              className={`mt-1 inline-block rounded px-1.5 py-0.5 text-sm font-semibold tabular-nums ${
                inStock ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {spare.balance_qty.toLocaleString()}
            </p>
          </div>
          {FIELDS.map((field) => (
            <div key={field.label}>
              <p className="text-xs text-slate-500">{field.label}</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{field.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`ໃຊ້ກັບສິນຄ້າ (${products.length})`}>
        {products.length === 0 ? (
          <Empty>ຍັງບໍ່ໄດ້ຜູກອາໄຫຼ່ນີ້ກັບສິນຄ້າໃດ</Empty>
        ) : (
          <Table head={["ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຮຸ່ນ", "ຫຍີ່ຫໍ້"]} minWidth={700}>
            {products.map((product) => (
              <tr key={product.product_code} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#0536a9]">{product.product_code}</td>
                <td className="px-3 py-2.5">
                  <span className="block font-medium text-slate-800">{product.name_1 || "-"}</span>
                  {product.name_2 && <span className="block text-[10px] text-slate-400">{product.name_2}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{product.item_model || "-"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{product.item_brand || "-"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
