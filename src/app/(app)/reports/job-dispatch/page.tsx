import { ReportShell, reportState, type SummaryItem } from "@/components/report-shell";
import { SelectField } from "@/components/select-field";
import {
  columns,
  fetchDispatchProducts,
  fetchJobDispatch,
  one,
  toTableColumns,
  type Row,
  type SearchParams,
} from "@/lib/report-sql";

/* ods: /report_job_dispatch + /report_sv_home + /report_jdispatch — Services.py */
export default async function JobDispatchReport({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const productCode = one(params.product_code)?.trim() ?? "";
  const state = reportState(params);

  let rows: Row[] = [];
  let products: Row[] = [];
  let error: string | null = null;
  try {
    [rows, products] = await Promise.all([fetchJobDispatch(productCode), fetchDispatchProducts()]);
  } catch (exception) {
    error = exception instanceof Error ? exception.message : "ດຶງຂໍ້ມູນບໍ່ສຳເລັດ";
  }

  // ສະຫຼຸບ — ນັບຈາກແຖວຊຸດດຽວກັນກັບຕາຕະລາງ: ຈຳນວນໃບເບີກ (ບໍ່ຊ້ຳ), ຈຳນວນອາໄຫຼ່ລວມ ແລະ ຊະນິດອາໄຫຼ່ (ບໍ່ຊ້ຳ)
  const summary: SummaryItem[] = [
    { label: "ໃບເບີກ (ບໍ່ຊ້ຳ)", value: new Set(rows.map((row) => String(row.doc_no ?? ""))).size.toLocaleString() },
    {
      label: "ຈຳນວນອາໄຫຼ່ລວມ",
      value: rows.reduce((sum, row) => sum + (Number(row.qty ?? 0) || 0), 0).toLocaleString(),
    },
    { label: "ຊະນິດອາໄຫຼ່ (ບໍ່ຊ້ຳ)", value: new Set(rows.map((row) => String(row.item_code ?? ""))).size.toLocaleString() },
  ];

  return (
    <ReportShell
      title="ລາຍງານການເບີກອາໄຫຼ່"
      subtitle={productCode ? `ເລືອກຈາກເຄື່ອງສ້ອມ: ${productCode}` : "ເລືອກທັງໝົດ"}
      basePath="/reports/job-dispatch"
      query={productCode ? { product_code: productCode } : {}}
      omitFromForm={["product_code"]}
      state={state}
      filters={
        <label className="block w-96">
          <span className="mb-1 block text-[11px] text-slate-500">ເລືອກຈາກເຄື່ອງສ້ອມ</span>
          <SelectField
            name="product_code"
            defaultValue={productCode}
            placeholder="ເລືອກທັງໝົດ"
            options={products.map((product) => ({
              value: String(product.code),
              label: `${product.code} — ${product.label}`,
            }))}
          />
        </label>
      }
      columns={toTableColumns(columns.jobDispatch)}
      rows={rows}
      error={error}
      summary={summary}
      exportHref={`/api/reports/export/job-dispatch?product_code=${encodeURIComponent(productCode)}`}
      minWidth={2400}
      searchPlaceholder="ຄົ້ນຫາ ເລກທີເບີກ, ລະຫັດອາໄຫຼ່, ຊື່ອາໄຫຼ່, ລູກຄ້າ..."
    />
  );
}
