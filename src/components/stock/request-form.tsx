"use client";

import { saveRequest, type StockState } from "@/app/actions/stock";
import { FormError, SaveBar } from "@/components/stock/save-bar";
import { WhShelfSelect, type Shelf, type Warehouse } from "@/components/stock/wh-shelf-select";
import { inputClass } from "@/components/ui";
import { CalendarDays, FileText, PackageCheck, Warehouse as WarehouseIcon } from "lucide-react";
import { useActionState } from "react";

export type RequestHead = {
  checked_at: string | null;
  customer: string | null;
  product: string | null;
  brand: string | null;
  warranty: string | null;
  issue: string | null;
  issue_2: string | null;
  technician: string | null;
  product_code: string;
};

/** ods: templates/stock/req_page.html + /save_req */
export function RequestForm({
  head,
  docNo,
  today,
  warehouses,
  shelves,
  hasSpares,
  warehouseValue,
  shelfValue,
  onWarehouseChange,
  onShelfChange,
}: {
  head: RequestHead;
  docNo: string;
  today: string;
  warehouses: Warehouse[];
  shelves: Shelf[];
  hasSpares: boolean;
  warehouseValue: string;
  shelfValue: string;
  onWarehouseChange: (value: string) => void;
  onShelfChange: (value: string) => void;
}) {
  const [state, action] = useActionState<StockState, FormData>(saveRequest, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="Product_code" value={head.product_code} />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <SaveBar backHref="/dashboard/status/repair/wait-withdraw" disabled={!hasSpares || !warehouseValue || !shelfValue} />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-slate-600">
              <FileText className="size-3.5 text-teal-600" />
              ເລກທີ <b className="font-mono text-slate-800">{docNo}</b>
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-slate-600">
              <CalendarDays className="size-3.5 text-teal-600" />
              ວັນທີ <b className="text-slate-800">{today}</b>
            </span>
          </div>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <PackageCheck className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-800">ຂໍ້ມູນວຽກສ້ອມ</h2>
                <p className="text-[11px] text-slate-400">ກວດສອບວຽກ ແລະອາການກ່ອນສ້າງໃບຂໍເບີກ</p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
              <Info label="ລູກຄ້າ" value={head.customer} />
              <Info label="ສິນຄ້າ / SN" value={head.product} />
              <Info label="ຍີ່ຫໍ້" value={head.brand} />
              <Info label="ປະກັນ" value={head.warranty} badge />
              <Info label="ອາການເບື້ອງຕົ້ນ" value={head.issue} danger />
              <Info label="ອາການທີ່ຊ່າງວິເຄາະ" value={head.issue_2} danger />
              <Info label="ຊ່າງສ້ອມ" value={head.technician} />
              <Info label="ກວດເຊັກສຳເລັດ" value={head.checked_at} />
            </dl>
          </div>

          <aside className="border-t border-slate-200 bg-slate-50/70 p-5 xl:border-l xl:border-t-0">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-700">
                <WarehouseIcon className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-800">ສາງທີ່ຕ້ອງການຂໍເບີກ</h2>
                <p className="text-[11px] text-slate-400">ເລືອກສາງເພື່ອກວດຍອດອາໄຫຼ່ດ້ານລຸ່ມ</p>
              </div>
            </div>
            <div className="space-y-3">
              <WhShelfSelect
                warehouses={warehouses}
                shelves={shelves}
                labelClassName="text-xs font-medium text-slate-600"
                warehouseValue={warehouseValue}
                shelfValue={shelfValue}
                onWarehouseChange={onWarehouseChange}
                onShelfChange={onShelfChange}
              />
              {!warehouseValue || !shelfValue ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                  ຕ້ອງເລືອກສາງ ແລະທີ່ເກັບກ່ອນ ຈຶ່ງຈະບັນທຶກໃບຂໍເບີກໄດ້
                </p>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">ໝາຍເຫດສຳລັບສາງ</span>
                <textarea
                  name="remark"
                  rows={3}
                  placeholder="ເພີ່ມໝາຍເຫດ..."
                  className={`${inputClass} min-h-20 resize-y py-2`}
                />
              </label>
            </div>
          </aside>
        </div>
      </section>

      <FormError message={state.error} />
    </form>
  );
}

function Info({ label, value, danger, badge }: { label: string; value: string | null; danger?: boolean; badge?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={`mt-1 text-xs font-semibold ${
          danger ? "text-red-600" : badge ? "inline-flex rounded-md bg-emerald-50 px-2 py-1 text-emerald-700" : "text-slate-800"
        }`}
      >
        {value || "-"}
      </dd>
    </div>
  );
}
