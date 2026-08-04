import { getSession } from "@/lib/auth";
import { queryOdg } from "@/lib/db";
import { installRevenueDetail } from "@/lib/service-money";
import { ERP } from "@/lib/stock-constants";
import { NextResponse } from "next/server";

/**
 * **Export CSV** ຂອງ 2 ໜ້າເງິນ: `receipts` (ບິນຂາຍຝ່າຍບໍລິການ) · `install-revenue` (ລາຍຮັບງານຕິດຕັ້ງ).
 *
 * ໃຊ້ **ສູດດຽວກັບໜ້າຈໍ** (installRevenueDetail / ເງື່ອນໄຂ side_code 400) ⇒ ໄຟລ໌ທີ່ໂຫຼດອອກ
 * ຈະບໍ່ຂັດກັບຕົວເລກທີ່ຄົນເຫັນຢູ່ໜ້າຈໍ.
 *
 * ⚠️ ໃສ່ BOM (﻿) ນຳໜ້າ — ບໍ່ດັ່ງນັ້ນ Excel ເປີດແລ້ວ**ພາສາລາວເປັນຕົວຫຍຸ້ງ**.
 */
export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-\d{2}$/;

/** ຫຸ້ມຄ່າໃຫ້ປອດໄພ: ມີ , " ຫຼື ຂຶ້ນແຖວ ⇒ ຫຸ້ມດ້ວຍ " ແລະ ຫຼົບ " ເປັນ "" */
const cell = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = (head: string[], rows: unknown[][]) =>
  "﻿" + [head, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ບໍ່ໄດ້ເຂົ້າສູ່ລະບົບ" }, { status: 401 });

  const { kind } = await params;
  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month") ?? "";
  const month = MONTH_RE.test(monthParam) ? monthParam : "";

  try {
    if (kind === "install-revenue") {
      const base = month || new Date().toISOString().slice(0, 7);
      const [year, mon] = base.split("-").map(Number);
      const from = `${base}-01`;
      const to = `${base}-${String(new Date(year, mon, 0).getDate()).padStart(2, "0")}`;
      // ດຶງເຖິງ 5,000 ແຖວ — ພຽງພໍສຳລັບ 1 ເດືອນ (ສູງສຸດທີ່ເຄີຍເຫັນ ~280 ໃບງານ)
      const rows = await installRevenueDetail(from, to, 5000);
      const csv = toCsv(
        ["ໃບງານ", "ວັນປິດງານ", "ລູກຄ້າ", "ຊ່າງ", "ບິນຂາຍ ERP", "ຄ່າບໍລິການ", "ບາດ"],
        rows.map((row) => [
          row.code,
          row.finished,
          row.customer,
          row.tech,
          row.bill_no,
          row.items,
          Math.round(row.baht),
        ]),
      );
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="install-revenue-${base}.csv"`,
        },
      });
    }

    if (kind === "receipts") {
      const args: (string | number)[] = [ERP.SIDE_CODE];
      const where = ["t.trans_flag = 44", `t.side_code = $1`];
      if (month) {
        args.push(`${month}-01`);
        where.push(`t.doc_date >= $${args.length}::date and t.doc_date < ($${args.length}::date + interval '1 month')`);
      }
      const { rows } = await queryOdg<{
        doc_no: string;
        doc_date: string | null;
        customer: string | null;
        items: string | null;
        amount: number;
        department: string | null;
      }>(
        `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date,
            coalesce(nullif(c.name_1,''), nullif(t.cust_code,'')) customer,
            (select string_agg(d.item_name, ' · ' order by d.line_number)
               from ic_trans_detail d where d.doc_no = t.doc_no) items,
            coalesce(t.total_amount,0)::float8 amount,
            nullif(t.department_code,'') department
          from ic_trans t
          left join ar_customer c on c.code = t.cust_code
         where ${where.join(" and ")}
         order by t.doc_date desc, t.doc_no desc
         limit 20000`,
        args,
      );
      const csv = toCsv(
        ["ເລກໃບ", "ວັນທີ", "ລູກຄ້າ", "ລາຍການ", "ຍອດ (ບາດ)", "ພະແນກ"],
        rows.map((row) => [row.doc_no, row.doc_date, row.customer, row.items, Math.round(row.amount), row.department]),
      );
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="service-bills-${month || "all"}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "ບໍ່ຮູ້ຈັກປະເພດ export" }, { status: 404 });
  } catch (error) {
    console.error("export failed", error);
    return NextResponse.json({ error: "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
