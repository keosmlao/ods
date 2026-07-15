"use client";
import { SelectField, type Option } from "@/components/select-field";
import { Package, Search } from "lucide-react";
import { useRef, useState } from "react";

/**
 * ຄົ້ນຫາ + ກັ່ນຕອງຫຍີ່ຫໍ້ຂອງລາຍການອາໄຫຼ່.
 * ຫຍີ່ຫໍ້ມີ 435 ອັນ ຈຶ່ງໃຊ້ SelectField (react-select) ທີ່ພິມຄົ້ນຫາໄດ້ ແທນ <select> ທຳມະດາ.
 * ເລືອກຫຍີ່ຫໍ້ແລ້ວສົ່ງຟອມເລີຍ — ບໍ່ຕ້ອງກົດ "ຄົ້ນຫາ" ອີກເທື່ອ.
 * ຊ່ອງ "ຮຸ່ນສິນຄ້າ" ຄົ້ນຫາຍ້ອນກັບ — ພິມຮຸ່ນ/ລະຫັດສິນຄ້າ ແລ້ວໄດ້ອາໄຫຼ່ທີ່ໃຊ້ກັບຮຸ່ນນັ້ນ.
 */
export function SpareFilters({
  q,
  brand,
  product,
  brands,
  tab,
  sort,
  dir,
}: {
  q: string;
  brand: string;
  product: string;
  brands: Option[];
  tab: string;
  sort: string;
  dir: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [current, setCurrent] = useState(brand);

  return (
    <form ref={formRef} className="flex flex-1 flex-wrap items-center gap-2">
      {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="dir" value={dir} />

      <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
        <Search className="size-3.5 shrink-0 text-slate-400" />
        <input
          name="q"
          defaultValue={q}
          placeholder="ຄົ້ນຫາ ລະຫັດ, ຊື່ອາໄຫຼ່..."
          className="w-full text-xs outline-none"
        />
      </div>

      <div className="flex h-9 min-w-52 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
        <Package className="size-3.5 shrink-0 text-slate-400" />
        <input
          name="product"
          defaultValue={product}
          placeholder="ຮຸ່ນສິນຄ້າທີ່ໃຊ້ອາໄຫຼ່..."
          className="w-full text-xs outline-none"
        />
      </div>

      <div className="min-w-52 text-xs">
        <SelectField
          name="brand"
          options={brands}
          value={current}
          onChange={(value) => {
            setCurrent(value);
            // ລໍຖ້າໃຫ້ hidden input ຮັບຄ່າໃໝ່ກ່ອນຈຶ່ງສົ່ງຟອມ
            setTimeout(() => formRef.current?.requestSubmit(), 0);
          }}
          placeholder="ທຸກຫຍີ່ຫໍ້"
        />
      </div>

      <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
    </form>
  );
}
