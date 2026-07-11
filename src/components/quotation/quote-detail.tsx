import { Card, Table } from "@/components/ui";
import Image from "next/image";

/** ຫົວບິນ + ລາຍການ ຂອງໃບສະເໜີລາຄາ — ໃຊ້ຮ່ວມກັນລະຫວ່າງໜ້າອະນຸມັດພາຍໃນ ແລະ ໜ້າລູກຄ້າອະນຸມັດ */

export type DetailHead = {
  doc_no: string;
  doc_date: string | null;
  customer: string | null;
  product: string | null;
  model: string | null;
  sn: string | null;
  brand: string | null;
  issue: string | null;
  warranty: string | null;
  issue_2: string | null;
  user_regis: string | null;
  technician: string | null;
  user_created: string | null;
  product_url: string | null;
  product_code: string | null;
  approver1?: string | null;
};

export type DetailLine = {
  item_code: string;
  item_name: string;
  qty: string;
  unit_code: string | null;
  price: string;
  sum_amount: string;
};

const money = (v: string | number | null) => {
  const n = Number(String(v ?? "0").replace(/,/g, ""));
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function Field({ label, value, accent }: { label: string; value: string | null | undefined; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-slate-500">{label}:</dt>
      <dd className={accent ? "font-medium text-[#b91c1c]" : "text-slate-800"}>{value || "-"}</dd>
    </div>
  );
}

export function QuoteDetail({
  head,
  lines,
  actions,
  showApprover,
}: {
  head: DetailHead;
  lines: DetailLine[];
  actions: React.ReactNode;
  showApprover?: boolean;
}) {
  const total = lines.reduce((sum, line) => sum + Number(line.sum_amount ?? 0), 0);

  return (
    <div className="w-full space-y-5">
      <Card title={`ໃບສະເໜີລາຄາ ${head.doc_no}`}>
        {actions}

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 md:col-span-2">
            <Field label="ເລກທິໃບກວດເຊັກ" value={head.doc_no} />
            <Field label="ວັນທີ" value={head.doc_date} />
            <Field label="ລູກຄ້າ" value={head.customer} />
            <Field label="ຊື່ສິນຄ້າ" value={head.product} />
            <Field label="Model" value={head.model} />
            <Field label="SN" value={head.sn} />
            <Field label="BRAND" value={head.brand} />
            <Field label="ປະກັນ" value={head.warranty} />
            <Field label="ອາການເສຍ" value={head.issue} accent />
            <Field label="ອາການຊ່າງ" value={head.issue_2} accent />
            <Field label="ຊ່າງ" value={head.technician} />
            <Field label="ຜູ້ຮັບເຄື່ອງ" value={head.user_regis} />
            <Field label="ຜູ້ຂໍອະນຸມັດ" value={head.user_created} />
            {showApprover && <Field label="ຜູ້ອະນຸມັດ" value={head.approver1} />}
          </dl>

          <div className="grid place-items-start justify-center">
            {head.product_url ? (
              <a href={`/api/uploads/${encodeURIComponent(head.product_url)}`} target="_blank" rel="noreferrer">
                <Image
                  src={`/api/uploads/${encodeURIComponent(head.product_url)}`}
                  alt=""
                  width={200}
                  height={200}
                  unoptimized
                  className="size-48 rounded-lg object-cover"
                />
              </a>
            ) : (
              <span className="grid size-48 place-items-center rounded-lg bg-slate-100 text-sm text-slate-400">ບໍ່ມີຮູບ</span>
            )}
          </div>
        </div>
      </Card>

      <Card title="ອາໄຫຼ່ທີ່ໃຊ້">
        <Table head={["ລະຫັດສິນຄ້າ", "ຊື່ສິນຄ້າ", "ຈຳນວນ", "ຫົວໜ່ວຍ", "ລາຄາ", "ລວມ"]} minWidth={800}>
          {lines.map((line, index) => (
            <tr key={`${line.item_code}-${index}`} className="border-b border-slate-100">
              <td className="whitespace-nowrap px-3 py-2">{line.item_code}</td>
              <td className="px-3 py-2">{line.item_name}</td>
              <td className="px-3 py-2 text-center">{Number(line.qty)}</td>
              <td className="px-3 py-2">{line.unit_code ?? "-"}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{money(line.price)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold">{money(line.sum_amount)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-400">ບໍ່ພົບລາຍການ</td></tr>
          )}
          <tr className="border-t border-slate-200">
            <td colSpan={5} className="px-3 py-3 text-right font-bold">ລວມ</td>
            <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-[#e75555]">{money(total)}</td>
          </tr>
        </Table>
      </Card>
    </div>
  );
}
