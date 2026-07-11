"use client";
import { useId, useState } from "react";
import Select, { type StylesConfig } from "react-select";

export type Option = { value: string; label: string };

/**
 * Dropdown ກາງຂອງລະບົບ — ໃຊ້ react-select ຈຶ່ງພິມຄົ້ນຫາໄດ້.
 * ຈຳເປັນເພາະບາງລາຍການຍາວຫຼາຍ (ປະເພດສິນຄ້າຈາກ ERP ມີ 266 ອັນ).
 *
 * ສົ່ງຄ່າອອກຜ່ານ <input type="hidden" name=...> ຈຶ່ງໃຊ້ກັບ server action / form
 * ທຳມະດາໄດ້ ໂດຍບໍ່ຕ້ອງແກ້ຫຍັງຢູ່ຝັ່ງ server.
 */

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
  menu: (base) => ({ ...base, borderRadius: "0.5rem", zIndex: 30, fontSize: "0.875rem" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "#0d9488" : state.isFocused ? "#f0fdfa" : "white",
    color: state.isSelected ? "white" : "#334155",
  }),
  placeholder: (base) => ({ ...base, color: "#94a3b8" }),
};

export function SelectField({
  name,
  options,
  defaultValue = "",
  value,
  onChange,
  placeholder = "ເລືອກ...",
  isDisabled,
}: {
  name: string;
  options: Option[];
  /** ໃຊ້ແບບ uncontrolled (ຟອມທຳມະດາ) */
  defaultValue?: string;
  /** ຫຼືແບບ controlled (ຖ້າຄ່າຖືກຕື່ມມາຈາກທີ່ອື່ນ ເຊັ່ນການຍິງບາໂຄດ) */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const selected = options.find((option) => option.value === current) ?? null;

  return (
    <>
      <Select
        instanceId={useId()}
        options={options}
        value={selected}
        onChange={(option) => {
          const next = option?.value ?? "";
          if (onChange) onChange(next);
          else setInternal(next);
        }}
        placeholder={placeholder}
        isClearable
        isDisabled={isDisabled}
        noOptionsMessage={() => "ບໍ່ພົບ"}
        styles={styles}
      />
      {/* ຄ່າທີ່ຖືກ submit ຈິງ — ບໍ່ໃສ່ required ເພາະ browser ຟ້ອງ "not focusable" ກັບ hidden input;
          server (zod) ກວດຄ່າຈຳເປັນຢູ່ແລ້ວ */}
      <input type="hidden" name={name} value={current} />
    </>
  );
}
