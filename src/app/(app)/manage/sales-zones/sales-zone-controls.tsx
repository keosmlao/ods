"use client";
import { addSalesZone, removeSalesZone } from "@/app/actions/sales-zone";
import { SelectField } from "@/components/select-field";
import { LoaderCircle, Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

type Option = { code: string; name_1: string };
type City = { code: string; name_1: string; province: string };

/** ຟອມເພີ່ມເຂດໃຫ້ພະນັກງານຂາຍ — ພະນັກງານ + ແຂວງ + ເມືອງ (ຫວ່າງ = ທັງແຂວງ) */
export function AddZoneForm({
  employees,
  provinces,
  cities,
}: {
  employees: Option[];
  provinces: Option[];
  cities: City[];
}) {
  const [employee, setEmployee] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const cityOptions = useMemo(
    () => cities.filter((c) => c.province === province).map((c) => ({ value: c.code, label: c.name_1 })),
    [cities, province],
  );

  function submit() {
    if (!employee || !province) {
      setError("ກະລຸນາເລືອກ ພະນັກງານ ແລະ ແຂວງ");
      return;
    }
    setError("");
    start(async () => {
      const result = await addSalesZone(employee, province, city);
      if (result.error) setError(result.error);
      else {
        setProvince("");
        setCity("");
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-slate-700">ເພີ່ມເຂດຮັບຜິດຊອບ</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">ພະນັກງານຂາຍ</label>
          <SelectField
            name="employee"
            value={employee}
            onChange={setEmployee}
            placeholder="ເລືອກ..."
            options={employees.map((e) => ({ value: e.code, label: e.name_1 }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">ແຂວງ</label>
          <SelectField
            name="province"
            value={province}
            onChange={(next) => { setProvince(next); setCity(""); }}
            placeholder="ເລືອກແຂວງ..."
            options={provinces.map((p) => ({ value: p.code, label: p.name_1 }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">ເມືອງ (ຫວ່າງ = ທັງແຂວງ)</label>
          <SelectField
            name="city"
            value={city}
            onChange={setCity}
            isDisabled={!province}
            placeholder="ທັງແຂວງ"
            options={cityOptions}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            ເພີ່ມ
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

/** ປຸ່ມລົບເຂດ 1 ແຖວ */
export function RemoveZoneButton({ employeeCode, provine, city }: { employeeCode: string; provine: string; city: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await removeSalesZone(employeeCode, provine, city);
            if (result.error) setError(result.error);
          })
        }
        title="ລົບເຂດນີ້"
        className="inline-flex size-6 items-center justify-center rounded-full text-red-500 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      </button>
      {error && <span className="ml-1 text-[10px] text-red-600">{error}</span>}
    </>
  );
}
