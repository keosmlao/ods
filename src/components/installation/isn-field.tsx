"use client";
import { inputClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { useEffect, useState } from "react";

/**
 * ຊ່ອງ ISN/SN ຂອງໜ້າ**ແກ້ໄຂງານຕິດຕັ້ງ** — ເລືອກຈາກລາຍການ ບໍ່ແມ່ນພິມລ້ວນ.
 *
 * ── ເປັນຫຍັງ ──
 * ຕອນເປີດງານ S/N **ບໍ່ບັງຄັບ** (CS ຢູ່ໜ້າເຄົາເຕີບໍ່ໄດ້ຖືເຄື່ອງຢູ່ນຳ — ເບິ່ງ install-form)
 * ⇒ ງານຈຳນວນຫຼາຍເປີດອອກມາໂດຍບໍ່ມີ ISN ແລ້ວມາຕື່ມພາຍຫຼັງຢູ່ໜ້ານີ້. ຊ່ອງພິມມືເປົ່າໆ
 * ພິມຜິດໄດ້ ⇒ ຮັບປະກັນ/ສ້ອມພາຍຫຼັງອ້າງອີງບໍ່ຖືກໜ່ວຍ.
 *
 * ລຳດັບຂອງລາຍການ (api/installations/serials):
 *   ① ໜ່ວຍທີ່ **ຂາຍໃນບິນຂອງງານ** (doc_ref) — ອັນທີ່ຖືກຕ້ອງເກືອບສະເໝີ
 *   ② ຄັງ ISN ຂອງລາຍການ — ໃຊ້ເມື່ອບິນບໍ່ໄດ້ລົງ ISN ໄວ້
 *   ③ ຫາບໍ່ພົບ ⇒ ກົດ "ພິມເອງ" (ເຄື່ອງທີ່ບໍ່ໄດ້ຊື້ຈາກໂອດ້ຽນ / ຂໍ້ມູນ ERP ຂາດ)
 *
 * ຄ່າທີ່ບັນທຶກ = `sn || isn` — ຄືກັນກັບຕອນເປີດງານ (install-form.loadBill) ຈຶ່ງບໍ່ເກີດ
 * ງານທີ່ເປີດແບບນຶ່ງ ແກ້ໄຂແລ້ວກາຍເປັນອີກແບບນຶ່ງ.
 */
type SerialRow = {
  isn: string;
  sn: string;
  in_stock: boolean;
  part?: string;
  source?: "bill" | "stock";
};

export function IsnField({
  name,
  defaultValue,
  itemCode,
  docRef,
  disabled,
  outdoor = false,
}: {
  name: string;
  defaultValue: string;
  itemCode: string | null;
  /** ບິນຂອງງານ (ods_tb_install.doc_ref_1) — ເອົາໜ່ວຍທີ່ຂາຍຈິງຂຶ້ນກ່ອນ */
  docRef: string | null;
  disabled?: boolean;
  /** ຊ່ອງນີ້ແມ່ນ **ໜ່ວຍນອກ** ຂອງແອ ⇒ ເອົາ ISN ຂອງ [H] ຂຶ້ນກ່ອນ (ບິນລົງແຍກໜ່ວຍ) */
  outdoor?: boolean;
}) {
  const t = useDict().installEditForm;
  const [value, setValue] = useState(defaultValue);
  const [rows, setRows] = useState<SerialRow[]>([]);
  const [loading, setLoading] = useState(Boolean(itemCode));
  const [manual, setManual] = useState(false);

  useEffect(() => {
    // ບໍ່ມີລະຫັດສິນຄ້າ ⇒ ບໍ່ມີຫຍັງໃຫ້ດຶງ (loading ຕັ້ງຕົ້ນເປັນ false ຢູ່ແລ້ວ) ⇒ ຊ່ອງພິມມື
    if (!itemCode) return;
    let alive = true;
    const params = new URLSearchParams({ item_code: itemCode });
    if (docRef) params.set("doc_ref", docRef);
    fetch(`/api/installations/serials?${params}`)
      .then((response) => response.json())
      .then((body: { data?: SerialRow[] }) => {
        if (!alive) return;
        /**
         * ແອ: ບິນລົງ ISN ແຍກ [C] ໜ່ວຍໃນ / [H] ໜ່ວຍນອກ ⇒ ຊ່ອງໃດຊ່ອງນັ້ນເອົາຂອງຕົນຂຶ້ນກ່ອນ
         * (ບໍ່ຕັດອອກ — ບາງບິນລົງ part ບໍ່ຄົບ ຄົນຍັງຕ້ອງເລືອກເອງໄດ້).
         */
        const rank = (row: SerialRow) =>
          row.source !== "bill" ? 2 : (row.part === "ໜ່ວຍນອກ") === outdoor ? 0 : 1;
        const data = [...(body.data ?? [])].sort((a, b) => rank(a) - rank(b));
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setRows([]);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [itemCode, docRef, outdoor]);

  const valueOf = (row: SerialRow) => row.sn || row.isn;
  const labelOf = (row: SerialRow) =>
    [
      row.isn,
      row.sn && `S/N ${row.sn}`,
      row.part,
      row.source === "bill" ? t.isnFromBill : t.isnFromStock,
      row.in_stock ? t.isnInStock : "",
    ]
      .filter(Boolean)
      .join(" · ");

  /** ຄ່າທີ່ບັນທຶກໄວ້ແຕ່ກ່ອນ ອາດບໍ່ຢູ່ໃນລາຍການ (ພິມມືມາແຕ່ເກົ່າ) ⇒ ຢ່າໃຫ້ມັນຫາຍ */
  const unlisted = value && !rows.some((row) => valueOf(row) === value);

  return (
    <div className="space-y-1">
      <input type="hidden" name={name} value={value} />

      {manual || (!loading && rows.length === 0) ? (
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t.isnTypePlaceholder}
          className={inputClass}
        />
      ) : (
        <select
          value={value}
          disabled={disabled || loading}
          onChange={(event) => setValue(event.target.value)}
          className={inputClass}
        >
          <option value="">{loading ? t.isnLoading : t.isnSelect}</option>
          {unlisted && (
            <option value={value}>
              {value} · {t.isnCurrent}
            </option>
          )}
          {rows.map((row) => (
            <option key={`${row.source}-${row.isn}`} value={valueOf(row)}>
              {labelOf(row)}
            </option>
          ))}
        </select>
      )}

      <p className="text-[11px] text-slate-400">
        {loading
          ? t.isnLoading
          : rows.length === 0
            ? t.isnNotFound
            : rows.some((row) => row.source === "bill")
              ? t.isnFromBillHint
              : t.isnFromStockHint}
        {!disabled && rows.length > 0 && (
          <button
            type="button"
            onClick={() => setManual(!manual)}
            className="ml-2 font-semibold text-brand-800 hover:underline"
          >
            {manual ? t.isnBackToList : t.isnTypeManually}
          </button>
        )}
      </p>
    </div>
  );
}
