"use client";

import { useActionState, useEffect, useState } from "react";
import { SelectField } from "@/components/select-field";
import { Card, LinkButton, inputClass, labelClass } from "@/components/ui";
import { createCustomer, updateCustomer } from "@/app/actions/customer";
import { useDict } from "@/lib/i18n/context";
import { Alert, SubmitButton } from "./shared";

/**
 * ຟອມລູກຄ້າ — ຖອດແບບຈາກ customer/addcust.html ແລະ customer/editcust.html
 * ແຂວງ → ເມືອງ ດຶງຈາກ /api/cities (ຄື /sel_city/<id> ຂອງ ods)
 *
 * ໝາຍເຫດ: ຟອມເກົ່າມີຊ່ອງ tax_id ໃນ edit_cust ແຕ່ ar_customer ບໍ່ມີຖັນນັ້ນ → ຕັດອອກ
 */
type Option = { code: string; name_1: string };

export type Customer = {
  code: string;
  name_1: string;
  name_2: string | null;
  address: string | null;
  provine: string | null;
  city: string | null;
  tel: string | null;
};

export function CustomerForm({
  provinces,
  customer,
  initialCities = [],
  nextCode,
}: {
  provinces: Option[];
  customer?: Customer;
  initialCities?: Option[];
  nextCode?: string;
}) {
  const t = useDict().customerForm;
  const editing = Boolean(customer);
  const [state, formAction, pending] = useActionState(editing ? updateCustomer : createCustomer, {});

  const [province, setProvince] = useState(customer?.provine ?? "");
  const [cities, setCities] = useState<Option[]>(initialCities);
  const [city, setCity] = useState(customer?.city ?? "");

  // ປ່ຽນແຂວງ → ດຶງລາຍການເມືອງຂອງແຂວງນັ້ນ (ຄື show_citylist() ຂອງ ods)
  // ຕອນເປີດໜ້າແກ້ໄຂ cities ຖືກ seed ດ້ວຍ initialCities ແລ້ວ → ບໍ່ມີການກະພິບ
  useEffect(() => {
    if (!province) return;

    let cancelled = false;
    fetch(`/api/cities?province=${encodeURIComponent(province)}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: Option[]) => {
        if (cancelled) return;
        setCities(rows);
        // ເມືອງທີ່ເລືອກໄວ້ບໍ່ຢູ່ໃນແຂວງໃໝ່ → ລ້າງ
        setCity((current) => (rows.some((row) => row.code === current) ? current : ""));
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [province]);

  // ປ່ຽນແຂວງດ້ວຍມື → ລ້າງເມືອງເກົ່າອອກທັນທີ ລໍຖ້າລາຍການໃໝ່
  function handleProvince(value: string) {
    setProvince(value);
    setCities([]);
    setCity("");
  }

  return (
    <div className="w-full space-y-4">
      <h1 className="text-center text-2xl font-bold text-slate-700">
        {editing ? t.editTitle : t.addTitle}
      </h1>
      <Alert state={state} />

      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <form action={formAction} className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="cust-code">{t.code}</label>
              <input
                id="cust-code"
                name="code"
                readOnly
                defaultValue={customer?.code ?? nextCode ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="cust-name1">{t.nameLao}</label>
              <input id="cust-name1" name="name_1" required defaultValue={customer?.name_1 ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="cust-name2">Name(ENG)</label>
              <input id="cust-name2" name="name_2" defaultValue={customer?.name_2 ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="cust-address">{t.address}</label>
              <input id="cust-address" name="address" defaultValue={customer?.address ?? ""} className={inputClass} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t.province}</label>
                <SelectField
                  name="province"
                  value={province}
                  onChange={handleProvince}
                  placeholder={t.selectProvince}
                  options={provinces.map((option) => ({ value: option.code, label: option.name_1 }))}
                />
              </div>
              <div>
                <label className={labelClass}>{t.city}</label>
                <SelectField
                  name="city"
                  value={city}
                  onChange={setCity}
                  isDisabled={!province}
                  placeholder={t.selectCity}
                  options={cities.map((option) => ({ value: option.code, label: option.name_1 }))}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="cust-tel">{t.tel}</label>
              {/* ods: ຟອມແກ້ໄຂລືມໃສ່ຄ່າເບີໂທເດີມ (value="") → ບ່ອນນີ້ໃສ່ຄືນໃຫ້ */}
              <input id="cust-tel" name="tel" defaultValue={customer?.tel ?? ""} className={inputClass} />
            </div>

            <div className="flex gap-2 pt-1">
              <SubmitButton pending={pending} />
              <LinkButton href="/customers" tone="neutral">{t.back}</LinkButton>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
