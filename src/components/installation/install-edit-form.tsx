"use client";
import { updateInstall, type ActionState } from "@/app/actions/installation";
import { SelectField } from "@/components/select-field";
import { Button, Card, ErrorBox, LinkButton, inputClass, labelClass } from "@/components/ui";
import { useDict } from "@/lib/i18n/context";
import { Save } from "lucide-react";
import { useActionState } from "react";

/** ຖອດແບບຈາກ ods: edit_install.html + /edit_save_install (install_admin.py) */

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
  item_prefix: string | null;
};

type Option = { code: string; name_1: string };
type Tech = { code: string; name: string };

export function InstallEditForm({
  row,
  categories,
  brands,
  techs,
}: {
  row: InstallRow;
  categories: Option[];
  brands: Option[];
  techs: Tech[];
}) {
  const t = useDict().installEditForm;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateInstall, {});
  // ods: ສິນຄ້າລະຫັດຂຶ້ນຕົ້ນ '97' ໃຫ້ເລືອກຍີ່ຫໍ້ໄດ້, ນອກນັ້ນອ່ານຢ່າງດຽວ
  const brandEditable = row.item_prefix === "97";

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      <input type="hidden" name="code" value={row.code} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="submit" tone="success" disabled={pending}>
            <Save className="size-4" />
            {pending ? t.saving : t.save}
          </Button>
          <LinkButton href="/installations" tone="danger">{t.exit}</LinkButton>
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
            <input name="pro_model" required defaultValue={row.pro_model ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t.typeLabel} *</label>
            <SelectField
              name="pro_type"
              defaultValue={row.pro_type_code ?? ""}
              options={categories.map((category) => ({ value: category.code, label: category.name_1 }))}
            />
          </div>
          <div>
            <label className={labelClass}>S/N *</label>
            <input name="pro_sn" defaultValue={row.pro_sn ?? ""} className={inputClass} />
          </div>
        </div>
      </Card>

      <Card title={t.installInfo}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t.tech}</label>
            <SelectField
              name="tech_code"
              defaultValue={row.tech_code ?? ""}
              options={techs.map((tech) => ({ value: tech.code, label: `${tech.name} (${tech.code})` }))}
              placeholder={t.selectTechPlaceholder}
            />
          </div>
          <div>
            <label className={labelClass}>{t.appointDateLabel}</label>
            <input type="date" name="appoint_date" defaultValue={row.appoint_date ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t.installLocation}</label>
            <input name="location_inst" defaultValue={row.location_inst ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t.remark}</label>
            <input name="remark" defaultValue={row.remark ?? ""} className={inputClass} />
          </div>
        </div>
      </Card>
    </form>
  );
}
