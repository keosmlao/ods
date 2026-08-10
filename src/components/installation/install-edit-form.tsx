"use client";
import { updateInstall, type ActionState } from "@/app/actions/installation";
import { IsnField } from "@/components/installation/isn-field";
import { SelectField } from "@/components/select-field";
import { Button, Card, ErrorBox, LinkButton, inputClass, labelClass } from "@/components/ui";
import { HelperPicker } from "@/components/tech-helpers";
import { useDict } from "@/lib/i18n/context";
import { Save } from "lucide-react";
import { useActionState, useState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";

/**
 * ຖອດແບບຈາກ ods: edit_install.html + /edit_save_install (install_admin.py)
 *
 * ── ໂໝດ "ISN ຢ່າງດຽວ" (isnOnly) ──
 * ງານທີ່**ປິດແລ້ວ** ແກ້ຫຍັງບໍ່ໄດ້ເລີຍມາແຕ່ກ່ອນ ⇒ ງານທີ່ຖືກປິດໂດຍທີ່ຍັງບໍ່ໄດ້ລົງ ISN
 * (S/N ບໍ່ບັງຄັບຕອນເປີດງານ — ເບິ່ງ install-form) ຈະບໍ່ມີວັນມີ ISN ອີກຈັກເທື່ອ ແລະ
 * ການຮັບປະກັນ/ສ້ອມພາຍຫຼັງອ້າງອີງໜ່ວຍນັ້ນບໍ່ໄດ້. ດຽວນີ້ເປີດໃຫ້**ຕື່ມ ISN ຄືນຫຼັງ**ໄດ້
 * ສ່ວນຊ່ອງອື່ນ (ຊ່າງ · ວັນນັດ · ສະຖານທີ່ …) ຍັງລັອກຄືເກົ່າ ເພາະງານຈົບໄປແລ້ວ
 * ແລະ ຄ່າຄອມຂອງຊ່າງຄິດຈາກຂໍ້ມູນນັ້ນແລ້ວ. ດ່ານຈິງຢູ່ຝັ່ງ server (actions/installation).
 */

export type InstallRow = {
  code: string;
  time_register: string | null;
  cust_code: string | null;
  cust_name: string | null;
  tel: string | null;
  address: string | null;
  doc_ref_1: string | null;
  doc_ref_date: string | null;
  user_created: string | null;
  tech_code: string | null;
  remark: string | null;
  item_code: string | null;
  item_name: string | null;
  pro_brand: string | null;
  pro_model: string | null;
  pro_type_code: string | null;
  pro_size: string | null;
  appoint_date: string | null;
  location_inst: string | null;
  pro_sn: string | null;
  /** ISN ໜ່ວຍນອກ (ແອ) — ຂຽນຕອນເປີດງານ ແຕ່ແຕ່ກ່ອນບໍ່ມີໜ້າໃດສະແດງ/ແກ້ */
  pro_sn_out: string | null;
  /** ຊື່ໝວດສິນຄ້າ (ods_tb_install.pro_type) — ໃຊ້ຮູ້ວ່າແມ່ນແອບໍ */
  pro_type: string | null;
  item_prefix: string | null;
  /** ງານປິດແລ້ວ (job_finish) — ໜ້າແກ້ໄຂເປີດໃຫ້ແຕ່ ISN */
  closed?: boolean;
};

type Option = { code: string; name_1: string };
type Tech = { code: string; name: string };

export function InstallEditForm({
  row,
  categories,
  brands,
  techs,
  helpers = [],
  isnOnly = false,
}: {
  row: InstallRow;
  categories: Option[];
  brands: Option[];
  techs: Tech[];
  /** ຊ່າງຮ່ວມທີ່ມີຢູ່ແລ້ວ (10-08-2026) — ຫົວໜ້າຢູ່ `row.tech_code` ຄືເກົ່າ */
  helpers?: string[];
  /** ງານປິດແລ້ວ ⇒ ແກ້ໄດ້ສະເພາະ ISN/SN */
  isnOnly?: boolean;
}) {
  const t = useDict().installEditForm;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateInstall, {});
  // ods: ສິນຄ້າລະຫັດຂຶ້ນຕົ້ນ '97' ໃຫ້ເລືອກຍີ່ຫໍ້ໄດ້, ນອກນັ້ນອ່ານຢ່າງດຽວ
  const brandEditable = row.item_prefix === "97" && !isnOnly;
  const nameOf = (options: Option[], code: string | null) =>
    options.find((option) => option.code === code)?.name_1 ?? code ?? "";
  const techName = techs.find((tech) => tech.code === row.tech_code);
  // ຫົວໜ້າປັດຈຸບັນຂອງຟອມ — ປ່ຽນ dropdown ແລ້ວລາຍຊ່າງຮ່ວມຕ້ອງຕັດຄົນນັ້ນອອກທັນທີ
  const [lead, setLead] = useState(row.tech_code ?? "");
  /** ແອ ⇒ ມີ 2 ISN (ໜ່ວຍໃນ/ໜ່ວຍນອກ) — ນິຍາມດຽວກັບຟອມເປີດງານ (install-form) */
  const isAc = `${row.pro_type ?? ""} ${row.item_name ?? ""}`.includes("ແອ") || (row.item_name ?? "").includes("AIR");

  return (
    <form action={formAction} className="space-y-5">
      <KeepFormValues />
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      <input type="hidden" name="code" value={row.code} />

      {isnOnly && (
        <p className="rounded-xl bg-brand-orange-100 px-4 py-3 text-xs font-semibold text-brand-900">
          {t.isnOnlyNotice}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="submit" tone="success" disabled={pending}>
            <Save className="size-4" />
            {pending ? t.saving : t.save}
          </Button>
          {/* ງານປິດແລ້ວບໍ່ຢູ່ໃນຄິວ /installations ⇒ ອອກແລ້ວກັບໄປໜ້າງານ ບໍ່ແມ່ນຄິວ */}
          <LinkButton
            href={isnOnly ? `/installations/${encodeURIComponent(row.code)}` : "/installations"}
            tone="danger"
          >
            {t.exit}
          </LinkButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={labelClass}>{t.jobNoLabel}</span>
            <input readOnly value={row.code} className={`${inputClass} w-40`} />
          </div>
          <div className="flex items-center gap-2">
            <span className={labelClass}>{t.jobDateLabel}</span>
            <input readOnly value={row.time_register ?? ""} className={`${inputClass} w-48`} />
          </div>
          <div className="flex items-center gap-2">
            <span className={labelClass}>{t.createdBy}</span>
            <input readOnly value={row.user_created ?? ""} className={`${inputClass} w-32`} />
          </div>
        </div>
      </div>

      <Card title={t.customerInfo}>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className={labelClass}>{t.customer}</label>
            <input readOnly value={row.cust_code ?? ""} className={inputClass} />
          </div>
          <div className="md:col-span-3">
            <label className={labelClass}>{t.name}</label>
            <input readOnly value={row.cust_name ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t.phone}</label>
            <input readOnly value={row.tel ?? ""} className={inputClass} />
          </div>
          <div className="md:col-span-3">
            <label className={labelClass}>{t.address}</label>
            <input readOnly value={row.address ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t.billNoLabel}</label>
            <input readOnly value={row.doc_ref_1 ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t.billDateLabel}</label>
            <input readOnly value={row.doc_ref_date ?? ""} className={inputClass} />
          </div>
        </div>
      </Card>

      <Card title={t.itemList}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className={labelClass}>{t.itemName} *</label>
            <input readOnly value={row.item_name ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t.brandLabel} *</label>
            {brandEditable ? (
              <SelectField
                name="pro_brand"
                defaultValue={row.pro_brand ?? ""}
                options={brands.map((brand) => ({ value: brand.code, label: brand.name_1 }))}
                placeholder={t.searchBrandPlaceholder}
              />
            ) : (
              <input name="pro_brand" readOnly value={row.pro_brand ?? ""} className={inputClass} />
            )}
          </div>
          <div>
            <label className={labelClass}>{t.modelLabel} *</label>
            {isnOnly ? (
              <input readOnly value={row.pro_model ?? ""} className={inputClass} />
            ) : (
              <input name="pro_model" required defaultValue={row.pro_model ?? ""} className={inputClass} />
            )}
          </div>
          <div>
            <label className={labelClass}>{t.typeLabel} *</label>
            {isnOnly ? (
              <input readOnly value={nameOf(categories, row.pro_type_code)} className={inputClass} />
            ) : (
              <SelectField
                name="pro_type"
                defaultValue={row.pro_type_code ?? ""}
                options={categories.map((category) => ({ value: category.code, label: category.name_1 }))}
              />
            )}
          </div>
          {/* ISN/SN — ເລືອກຈາກໜ່ວຍທີ່ຂາຍໃນບິນ ຫຼື ຄັງ (ພິມເອງກໍ່ຍັງໄດ້) */}
          <div className={isAc ? "" : "md:col-span-2"}>
            <label className={labelClass}>ISN / S/N {isAc && <span className="text-slate-400">(ໜ່ວຍໃນ)</span>}</label>
            <IsnField
              name="pro_sn"
              defaultValue={row.pro_sn ?? ""}
              itemCode={row.item_code}
              docRef={row.doc_ref_1}
            />
          </div>
          {/*
            ແອມີຄອມເພຣສເຊີຢູ່ນອກ ⇒ **ຄົນລະ ISN** (ຟອມເປີດງານເກັບຢູ່ pro_sn_out ມາແຕ່ຕົ້ນ
            ແຕ່ບໍ່ມີໜ້າໃດສະແດງ/ແກ້ໄດ້ເລີຍ). ບໍ່ແມ່ນແອ = ບໍ່ຂຶ້ນ.
          */}
          {isAc && (
            <div>
              <label className={labelClass}>ISN / S/N <span className="text-slate-400">(ໜ່ວຍນອກ)</span></label>
              <IsnField
                name="pro_sn_out"
                defaultValue={row.pro_sn_out ?? ""}
                itemCode={row.item_code}
                docRef={row.doc_ref_1}
                outdoor
              />
            </div>
          )}
        </div>
      </Card>

      <Card title={t.installInfo}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t.tech}</label>
            {isnOnly ? (
              <input
                readOnly
                value={techName ? `${techName.name} (${techName.code})` : (row.tech_code ?? "")}
                className={inputClass}
              />
            ) : (
              <SelectField
                name="tech_code"
                // controlled — ຕ້ອງຮູ້ຫົວໜ້າປັດຈຸບັນ ເພື່ອຕັດຄົນນັ້ນອອກຈາກລາຍຊ່າງຮ່ວມ
                value={lead}
                onChange={setLead}
                options={techs.map((tech) => ({ value: tech.code, label: `${tech.name} (${tech.code})` }))}
                placeholder={t.selectTechPlaceholder}
              />
            )}
            {/* ຊ່າງຮ່ວມ — ແກ້ໄດ້ຢູ່ຟອມນີ້ນຳ (ບໍ່ຕ້ອງກັບໄປ modal ຈັດຊ່າງ) */}
            {!isnOnly && lead && (
              <div className="mt-3">
                <HelperPicker
                  techs={techs.map((tech) => ({ code: tech.code, name: `${tech.name} (${tech.code})` }))}
                  lead={lead}
                  value={helpers}
                />
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>{t.appointDateLabel}</label>
            <input
              type="date"
              {...(isnOnly ? { readOnly: true, value: row.appoint_date ?? "" } : { name: "appoint_date", defaultValue: row.appoint_date ?? "" })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t.installLocation}</label>
            <input
              {...(isnOnly ? { readOnly: true, value: row.location_inst ?? "" } : { name: "location_inst", defaultValue: row.location_inst ?? "" })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t.remark}</label>
            <input
              {...(isnOnly ? { readOnly: true, value: row.remark ?? "" } : { name: "remark", defaultValue: row.remark ?? "" })}
              className={inputClass}
            />
          </div>
        </div>
      </Card>
    </form>
  );
}
