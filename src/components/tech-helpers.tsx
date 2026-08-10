"use client";

import { useState } from "react";

/**
 * **ເລືອກຊ່າງຮ່ວມ** (ຄົນທີ 2 ຂຶ້ນໄປ) — ໃຊ້ຮ່ວມທຸກຟອມທີ່ຈັດຊ່າງ (10-08-2026).
 *
 * ຫົວໜ້າ (`lead`) ຢູ່ຊ່ອງເກົ່າຂອງແຕ່ລະຟອມ ⇒ ອັນນີ້ເປັນພຽງ "ໃຜໄປນຳ". ຊ່າງຮ່ວມເຫັນງານ
 * ໃນແອັບ ແລະ check-in ໄດ້ ແຕ່ **ຮັບງານ · ຈົບງານ · ເກັບ ISN/SN ບໍ່ໄດ້** (ເບິ່ງ
 * lib/job-techs). ຄ່າຄອມແບ່ງຕາມ **ຮອບ check-in ຈິງ** ⇒ ໃສ່ຊື່ໄວ້ແຕ່ບໍ່ໄປ = ບໍ່ໄດ້ຫຍັງ.
 *
 * ໃຊ້ໄດ້ 2 ແບບ:
 *   ① ໃນ `<form>` — ສ້າງ hidden input ຊື່ `name` (ຄ່າ "A,B,C") ໃຫ້ server action ອ່ານ
 *   ② ຄຸມເອງ — ສົ່ງ `onChange` ເຂົ້າມາ ແລ້ວເອົາຄ່າໄປໃສ່ການເອີ້ນ action ໂດຍກົງ
 */
export function HelperPicker({
  techs,
  lead,
  value,
  onChange,
  name = "helper_codes",
  label = "ຊ່າງຮ່ວມ (ໄປນຳ — ບໍ່ໄດ້ກົດຮັບ/ຈົບງານ)",
}: {
  techs: { code: string; name: string }[];
  /** ຫົວໜ້າງານປັດຈຸບັນ — ບໍ່ໂຊ້ໃນລາຍການ (ຄົນດຽວກັນເປັນທັງສອງບໍ່ໄດ້) */
  lead: string;
  /** ຄ່າຕັ້ງຕົ້ນ (ຊ່າງຮ່ວມທີ່ມີຢູ່ແລ້ວ) */
  value?: string[];
  onChange?: (helpers: string[]) => void;
  name?: string;
  label?: string;
}) {
  const [picked, setPicked] = useState<string[]>(value ?? []);

  /**
   * ຫົວໜ້າຖືກປ່ຽນ ⇒ ລາວຫຼຸດອອກຈາກລາຍຊ່າງຮ່ວມທັນທີ — **ຄິດຕອນ render** ບໍ່ແມ່ນ
   * sync state ດ້ວຍ effect (ຄົນດຽວກັນເປັນທັງສອງບໍ່ໄດ້; server ກໍ່ຕັດອອກອີກຊັ້ນ).
   * ຄ່າເກົ່າຍັງຢູ່ໃນ state ⇒ ປ່ຽນຫົວໜ້າກັບຄືນ ຄົນນັ້ນເດັ້ງກັບມາເປັນຊ່າງຮ່ວມຄືເກົ່າ.
   */
  const helpers = picked.filter((code) => code !== lead);

  const toggle = (code: string) => {
    setPicked((current) => {
      const next = current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code];
      onChange?.(next.filter((item) => item !== lead));
      return next;
    });
  };

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-600">{label}</p>
      <input type="hidden" name={name} value={helpers.join(",")} />
      <div className="flex flex-wrap gap-1.5">
        {techs
          .filter((tech) => tech.code !== lead)
          .map((tech) => {
            const on = helpers.includes(tech.code);
            return (
              <button
                key={tech.code}
                type="button"
                onClick={() => toggle(tech.code)}
                className={`h-8 rounded-lg border px-2.5 text-xs font-semibold transition ${
                  on
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {on ? "✓ " : "+ "}
                {tech.name}
              </button>
            );
          })}
      </div>
    </div>
  );
}
