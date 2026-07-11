"use client";

import { SelectField } from "@/components/select-field";
import { useState } from "react";

export type Warehouse = { code: string; name_1: string };
export type Shelf = { code: string; name_1: string; whcode: string };

/**
 * ເລືອກສາງ → ທີ່ເກັບ (ods ໃຊ້ htmx /fetch_data_shelfx ດຶງທີ່ເກັບຕາມສາງ).
 * ຢູ່ນີ້ດຶງທີ່ເກັບມາໝົດແຕ່ຕົ້ນ ແລ້ວກັ່ນຕອງໃນ browser — ບໍ່ຕ້ອງເອີ້ນ server ອີກ.
 */
export function WhShelfSelect({ warehouses, shelves }: { warehouses: Warehouse[]; shelves: Shelf[] }) {
  const [wh, setWh] = useState("");
  const [shelf, setShelf] = useState("");
  const options = shelves.filter((row) => row.whcode === wh);

  return (
    <>
      <div className="block">
        <span className="mb-1 block text-sm text-white/80">ເລືອກສາງຂໍເບີກ:</span>
        <SelectField
          name="wh_code"
          value={wh}
          onChange={(value) => {
            setWh(value);
            // ປ່ຽນສາງ → ທີ່ເກັບເກົ່າໃຊ້ບໍ່ໄດ້ອີກ
            setShelf("");
          }}
          options={warehouses.map((warehouse) => ({
            value: warehouse.code,
            label: `${warehouse.code} ~ ${warehouse.name_1}`,
          }))}
        />
      </div>

      <div className="block">
        <span className="mb-1 block text-sm text-white/80">ທີ່ເກັບ:</span>
        <SelectField
          name="shelf_code"
          value={shelf}
          onChange={setShelf}
          isDisabled={!wh}
          placeholder="..."
          options={options.map((row) => ({ value: row.code, label: `${row.code} ~ ${row.name_1}` }))}
        />
      </div>
    </>
  );
}
