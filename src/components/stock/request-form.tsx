"use client";

import { saveRequest, type StockState } from "@/app/actions/stock";
import { FormError, SaveBar } from "@/components/stock/save-bar";
import { WhShelfSelect, type Shelf, type Warehouse } from "@/components/stock/wh-shelf-select";
import { inputClass } from "@/components/ui";
import { useActionState } from "react";

export type RequestHead = {
  checked_at: string | null;
  customer: string | null;
  product: string | null;
  warranty: string | null;
  issue: string | null;
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
}: {
  head: RequestHead;
  docNo: string;
  today: string;
  warehouses: Warehouse[];
  shelves: Shelf[];
  hasSpares: boolean;
}) {
  const [state, action] = useActionState<StockState, FormData>(saveRequest, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="Product_code" value={head.product_code} />

      <SaveBar backHref="/stock/requests" disabled={!hasSpares} />
      <FormError message={state.error} />

      <div className="grid gap-4 rounded-xl bg-[#0a5e96] p-5 text-white md:grid-cols-2">
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-white/70">ວັນທີ:</span> {today}
          </p>
          <p>
            <span className="text-white/70">ເລກທີ:</span> {docNo}
          </p>
          <p>
            <span className="text-white/70">ວັນ/ເວລາກວດເຊັກສຳເລັດ:</span> {head.checked_at ?? "-"}
          </p>
          <p>
            <span className="text-white/70">ລູກຄ້າ:</span> {head.customer ?? "-"}
          </p>
          <p>
            <span className="text-white/70">ຊື່ສິນຄ້າ:</span> {head.product ?? "-"}
          </p>
        </div>

        <div className="space-y-1 text-sm">
          <p>
            <span className="text-white/70">ອາການເສຍ:</span> <span className="text-[#ffd0d0]">{head.issue ?? "-"}</span>
          </p>
          <p>
            <span className="text-white/70">ປະກັນ:</span> {head.warranty ?? "-"}
          </p>
          <p>
            <span className="text-white/70">ຊ່າງສ້ອມ:</span> {head.technician ?? "-"}
          </p>
        </div>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm text-white/80">ໝາຍເຫດ:</span>
          <input type="text" name="remark" autoComplete="off" className={inputClass} />
        </label>

        <WhShelfSelect warehouses={warehouses} shelves={shelves} />
      </div>
    </form>
  );
}
