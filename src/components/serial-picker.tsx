"use client";
import { useId } from "react";
import type { StylesConfig } from "react-select";
import CreatableSelect from "react-select/creatable";

export type Serial = {
  roworder: number;
  /** ເລກປ້າຍ (ຄ່າຫຼັກ) */
  isn: string;
  /** ເລກໂຮງງານ */
  sn: string;
  item_code: string;
  item_name: string;
  status: number;
  /** ບິນທີ່ຂາຍໜ່ວຍນີ້ໃຫ້ລູກຄ້າ */
  doc_no?: string;
  doc_date?: string;
};

type Option = { value: string; label: string; serial: Serial | null };

const styles: StylesConfig<Option, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: "2.5rem",
    borderRadius: "0.5rem",
    borderColor: state.isFocused ? "#14b8a6" : "#cbd5e1",
    boxShadow: state.isFocused ? "0 0 0 2px #ccfbf1" : "none",
    "&:hover": { borderColor: state.isFocused ? "#14b8a6" : "#cbd5e1" },
    fontSize: "0.875rem",
  }),
  menu: (base) => ({ ...base, borderRadius: "0.5rem", zIndex: 30 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "#0d9488" : state.isFocused ? "#f0fdfa" : "white",
    color: state.isSelected ? "white" : "#334155",
  }),
  placeholder: (base) => ({ ...base, color: "#94a3b8" }),
};

/**
 * ເລືອກ Serial Number — ສະເພາະ ISN ຂອງສິນຄ້ານັ້ນ **ທີ່ຂາຍໃຫ້ລູກຄ້າລາຍນີ້**.
 * ບໍ່ເອົາທຸກໜ່ວຍໃນສາງ ເພາະລູກຄ້າເອົາຄືນມາໄດ້ແຕ່ໜ່ວຍທີ່ຕົນຊື້ໄປ.
 * ISN ຄືເລກທີ່ພິມຢູ່ປ້າຍ (ຄ່າຫຼັກ), SN ຄືເລກຈາກໂຮງງານ.
 * ພິມເອງໄດ້ ສຳລັບເຄື່ອງທີ່ບໍ່ໄດ້ຊື້ຈາກໂອດ້ຽນ.
 */
export function SerialPicker({
  serials,
  value,
  onPick,
  onType,
  isLoading,
  isDisabled,
}: {
  serials: Serial[];
  value: string;
  onPick: (serial: Serial) => void;
  onType: (text: string) => void;
  isLoading?: boolean;
  isDisabled?: boolean;
}) {
  const options: Option[] = serials.map((serial) => ({
    value: serial.isn || serial.sn,
    label: [serial.isn, serial.sn && `SN ${serial.sn}`, serial.doc_no && `ບິນ ${serial.doc_no}`].filter(Boolean).join(' — '),
    serial,
  }));

  const selected: Option | null = value
    ? (options.find((option) => option.value === value) ?? { value, label: value, serial: null })
    : null;

  return (
    <CreatableSelect
      instanceId={useId()}
      options={options}
      value={selected}
      isLoading={isLoading}
      isDisabled={isDisabled}
      isClearable
      onChange={(option) => {
        if (!option) { onType(""); return; }
        if (option.serial) onPick(option.serial);
        else onType(option.value);
      }}
      onCreateOption={(text) => onType(text)}
      formatCreateLabel={(text) => `ໃຊ້ເລກ "${text}" (ພິມເອງ)`}
      placeholder="ເລືອກ ISN, ພິມເອງ ຫຼືປະຫວ່າງໄວ້ (ບໍ່ບັງຄັບ)"
      noOptionsMessage={() => "ບໍ່ພົບ ISN — ພິມເອງ ຫຼືປະຫວ່າງໄວ້ກໍໄດ້"}
      loadingMessage={() => "ກຳລັງດຶງ..."}
      styles={styles}
    />
  );
}
