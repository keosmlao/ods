"use client";

import { addSpareToRequestFromDialog } from "@/app/actions/stock";
import { RequestForm, type RequestHead } from "@/components/stock/request-form";
import { EditableSpareLines, type SpareBalance, type SpareLine } from "@/components/stock/spare-lines";
import type { Shelf, Warehouse } from "@/components/stock/wh-shelf-select";
import { SpareSearchDialog } from "@/components/spare-search";
import { useState } from "react";

export function RequestWorkspace({
  head,
  docNo,
  today,
  warehouses,
  shelves,
  lines,
  roworder,
  balances,
  canRequest,
}: {
  head: RequestHead;
  docNo: string;
  today: string;
  warehouses: Warehouse[];
  shelves: Shelf[];
  lines: SpareLine[];
  roworder: string;
  balances: Record<string, SpareBalance>;
  canRequest: boolean;
}) {
  const [warehouse, setWarehouse] = useState("");
  const [shelf, setShelf] = useState("");
  const [searching, setSearching] = useState(false);
  const warehouseLabel = warehouses.find((item) => item.code === warehouse)?.name_1;

  return (
    <div className="space-y-4">
      <RequestForm
        head={head}
        docNo={docNo}
        today={today}
        warehouses={warehouses}
        shelves={shelves}
        hasSpares={lines.length > 0 && canRequest}
        warehouseValue={warehouse}
        shelfValue={shelf}
        onWarehouseChange={(value) => {
          setWarehouse(value);
          setShelf("");
        }}
        onShelfChange={setShelf}
      />
      <EditableSpareLines
        lines={lines}
        roworder={roworder}
        balances={balances}
        selectedWarehouse={warehouse}
        selectedShelf={shelf}
        warehouseLabel={warehouseLabel}
        onAddSpare={() => setSearching(true)}
      />
      {searching && (
        <SpareSearchDialog
          chosen={new Set(lines.map((line) => line.item_code))}
          onAdd={(item, qty) => addSpareToRequestFromDialog(roworder, head.product_code, item.code, qty)}
          onClose={() => setSearching(false)}
        />
      )}
    </div>
  );
}
