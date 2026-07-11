"use client";
import { useEffect, useId, useState } from "react";
import type { GroupBase, StylesConfig } from "react-select";
import CreatableSelect from "react-select/creatable";

export type ProductSource = "purchase" | "catalog";

export type Product = {
  item_code: string;
  item_name: string;
  brand: string;
  model: string;
  product_type: string;
  /** ມີສະເພາະສິນຄ້າທີ່ລູກຄ້າຊື້ໄປ */
  doc_no: string;
  doc_date: string;
  source: ProductSource;
};

type Option = { value: string; label: string; product: Product | null };
type Group = GroupBase<Option>;

const styles: StylesConfig<Option, false, Group> = {
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
  groupHeading: (base) => ({
    ...base,
    fontSize: "0.7rem",
    fontWeight: 700,
    color: "#0f766e",
    backgroundColor: "#f0fdfa",
    padding: "0.35rem 0.75rem",
    margin: 0,
    textTransform: "none",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? "#0d9488" : state.isFocused ? "#f0fdfa" : "white",
    color: state.isSelected ? "white" : "#334155",
  }),
  placeholder: (base) => ({ ...base, color: "#94a3b8" }),
};

function toOption(product: Product): Option {
  const detail =
    product.source === "purchase"
      ? `${product.brand || "ບໍ່ມີຫຍີ່ຫໍ້"} · ບິນ ${product.doc_no} (${product.doc_date})`
      : `${product.brand || "ບໍ່ມີຫຍີ່ຫໍ້"} · ${product.item_code}`;
  return { value: product.item_name, label: `${product.item_name} — ${detail}`, product };
}

/**
 * ເລືອກສິນຄ້າ — ຮອງຮັບທັງ 3 ປະເພດຂອງເຄື່ອງທີ່ເອົາມາສ້ອມ:
 *
 *  1. ລູກຄ້າຊື້ໄປຈາກໂອດ້ຽນ → ຂຶ້ນມາເອງທັນທີທີ່ເລືອກລູກຄ້າ (ໄດ້ບິນ + ວັນທີ)
 *  2. ລູກຄ້າບໍ່ໄດ້ຊື້ ແຕ່ມີໃນລາຍການສິນຄ້າ ERP → ພິມຄົ້ນຫາຈຶ່ງຂຶ້ນ (ໄດ້ ຍີ່ຫໍ້/Model/ໝວດ)
 *  3. ບໍ່ມີໃນລະບົບເລີຍ → ພິມຊື່ເອງ ("ໃຊ້ຊື່ ...")
 */
export function ProductPicker({
  products,
  customerRef,
  value,
  onPick,
  onType,
  isLoading,
}: {
  /** ປະຫວັດການຊື້ຂອງລູກຄ້າ — ໂຫຼດມາລ່ວງໜ້າແລ້ວ */
  products: Product[];
  /** ລະຫັດລູກຄ້າຢູ່ ERP — ໃຊ້ຄົ້ນຫາເພີ່ມຕອນພິມ */
  customerRef: string;
  value: string;
  onPick: (product: Product) => void;
  onType: (text: string) => void;
  isLoading?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);

  // ພິມແລ້ວຄົ້ນຫາຈາກ server — ຈຶ່ງເຫັນສິນຄ້າ ERP ທີ່ລູກຄ້າບໍ່ໄດ້ຊື້ນຳ
  useEffect(() => {
    if (typed.trim().length < 2) return;
    let cancelled = false;

    async function search() {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: typed.trim() });
        if (customerRef) params.set("customer", customerRef);
        const rows = await (await fetch(`/api/products?${params}`)).json();
        if (!cancelled) setFound(rows);
      } catch {
        if (!cancelled) setFound([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }
    const timer = setTimeout(search, 250);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [typed, customerRef]);

  // ຍັງບໍ່ພິມ → ສະແດງປະຫວັດການຊື້; ພິມແລ້ວ → ສະແດງຜົນຄົ້ນຫາ
  const rows = typed.trim().length >= 2 ? found : products;
  const purchased = rows.filter((row) => row.source === "purchase");
  const catalog = rows.filter((row) => row.source === "catalog");

  const groups: Group[] = [];
  if (purchased.length) groups.push({ label: "ສິນຄ້າທີ່ລູກຄ້າຊື້ໄປ", options: purchased.map(toOption) });
  if (catalog.length) groups.push({ label: "ສິນຄ້າໃນ ERP (ລູກຄ້າບໍ່ໄດ້ຊື້)", options: catalog.map(toOption) });

  const all = groups.flatMap((group) => group.options);
  const selected: Option | null = value
    ? (all.find((option) => option.value === value) ?? { value, label: value, product: null })
    : null;

  return (
    <CreatableSelect<Option, false, Group>
      instanceId={useId()}
      options={groups}
      value={selected}
      inputValue={typed}
      onInputChange={(text, meta) => { if (meta.action === "input-change") setTyped(text); }}
      isLoading={isLoading || searching}
      isClearable
      // ຄົ້ນຫາຢູ່ server ແລ້ວ — ບໍ່ໃຫ້ react-select ກອງຊ້ຳ
      filterOption={() => true}
      onChange={(option) => {
        setTyped("");
        if (!option) { onType(""); return; }
        if (option.product) onPick(option.product);
        else onType(option.value);
      }}
      onCreateOption={(text) => { setTyped(""); onType(text); }}
      formatCreateLabel={(text) => `ສ້າງໃໝ່: ໃຊ້ຊື່ "${text}"`}
      placeholder="ເລືອກຈາກປະຫວັດການຊື້, ຄົ້ນຫາໃນ ERP ຫຼືພິມຊື່ໃໝ່..."
      noOptionsMessage={() =>
        typed.trim().length >= 2 ? "ບໍ່ພົບໃນລະບົບ — ພິມຊື່ແລ້ວກົດ ສ້າງໃໝ່" : "ພິມເພື່ອຄົ້ນຫາໃນ ERP"
      }
      loadingMessage={() => "ກຳລັງຄົ້ນຫາ..."}
      styles={styles}
    />
  );
}
