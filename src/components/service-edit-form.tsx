"use client";
import { updateService } from "@/app/actions/service";
import { ClaimPartPicker } from "@/components/claim/claim-part-picker";
import { LocationPicker, type Point } from "@/components/installation/location-picker";
import { SelectField } from "@/components/select-field";
import { ONSITE_SERVICE_TYPES } from "@/lib/sla";
import { BrandField } from "@/components/service-brand-field";
import { useDict } from "@/lib/i18n/context";
import { REPAIR_CENTER_LABEL, REPAIR_CENTERS } from "@/lib/repair-center";
import { LoaderCircle, LogOut, Save, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { KeepFormValues } from "@/components/keep-form-values";

type Option = { code: string; name_1: string };
type Customer = { code: string; name_1: string; tel: string; address: string };

export type ServiceHead = {
  code: string;
  name_1: string;
  sn: string;
  p_model: string;
  p_type: string;
  p_brand: string;
  p_access: string;
  warrunty: string;
  p_delivery: string;
  service_type: string;
  issue: string;
  p_abrasion: string;
  cust_code: string;
  emp_code: string;
  ap_code: string;
  doc_def: string;
  doc_date_ref: string;
  cust_name: string;
  tel: string;
  address: string;
  /** ງານນອກສະຖານທີ່ (IH/PS) — ໃບເກົ່າຍັງຫວ່າງ (migration ບໍ່ໄດ້ເດົາຄ່າໃຫ້) */
  location_repair: string;
  /** ບ່ອນຮັບເຄື່ອງ (CI ເທົ່ານັ້ນ) — ແກ້ໄດ້ ເພາະດ່ານກ່ອນສົ່ງຄືນອີງຄ່ານີ້ */
  intake_center: string;
  appoint_date: string;
  /** ວັນເວລາຮັບເຄື່ອງ (time_register) — ຮູບແບບ datetime-local: YYYY-MM-DDTHH:MM */
  time_register: string;
  location_lat: number | null;
  location_lng: number | null;
  /** ປະເພດງານ — 'repair' ຫຼື 'claim' (ຮ້ານຄ້າ/ລູກຄ້າຂໍເຄມ) */
  job_kind: "repair" | "claim";
  claim_scope: string;
  claim_part_code: string;
  claim_part_name: string;
  claim_part_sn: string;
  claim_part_qty: number | null;
  /** ໃບເຄມ CLM ທີ່ຜູກຢູ່ກັບໃບງານນີ້ແລ້ວ (ຖ້າມີ) — ມີແລ້ວປ່ຽນກັບເປັນງານສ້ອມບໍ່ໄດ້ */
  claim_no: string | null;
};

const field = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 read-only:bg-slate-50";
const label = "mb-1 block text-sm text-slate-600";

/** ຮູບ 1 ຊ່ອງ — ສະແດງຮູບເກົ່າ ແລະເລືອກຮູບໃໝ່ໄດ້ (ຮູບໃໝ່ຈະຖືກເພີ່ມເຂົ້າ ຄື update_rcpro ຂອງ ods) */
function ImageSlot({ name, index, current, t }: { name: string; index: number; current?: string; t: { photoNumber: string; noImage: string; removeImage: string } }) {
  const [preview, setPreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview || (current ? `/api/uploads/${encodeURIComponent(current)}` : "");

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-3">
      <p className="mb-2 text-xs font-medium text-slate-500">{t.photoNumber} {index + 1}</p>
      <div className="mb-2 grid h-28 place-items-center overflow-hidden rounded bg-slate-50">
        {shown ? (
          <Image src={shown} alt="" width={160} height={112} unoptimized className="size-full object-cover" />
        ) : (
          <span className="text-xs text-slate-400">{t.noImage}</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setPreview((old) => { if (old) URL.revokeObjectURL(old); return file ? URL.createObjectURL(file) : ""; });
        }}
        className="w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs"
      />
      {preview && (
        <button
          type="button"
          onClick={() => { if (inputRef.current) inputRef.current.value = ""; setPreview((old) => { if (old) URL.revokeObjectURL(old); return ""; }); }}
          className="mt-2 text-xs text-brand-orange-700 hover:underline"
        >
          {t.removeImage}
        </button>
      )}
    </div>
  );
}

export function ServiceEditForm({ head, types, brands, techs, images }: {
  head: ServiceHead;
  types: Option[];
  brands: Option[];
  techs: { code: string; username: string }[];
  images: Record<number, string>;
}) {
  const t = useDict().serviceEditForm;
  const [state, action, pending] = useActionState(updateService, {});

  const [q, setQ] = useState(head.cust_name);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer>({ code: head.cust_code, name_1: head.cust_name, tel: head.tel, address: head.address });
  const [brand, setBrand] = useState(head.p_brand);

  /**
   * ງານນອກສະຖານທີ່ (IH/PS = 75% ຂອງໃບ) ຕ້ອງມີສະຖານທີ່ໜ້າງານ.
   * ໃບ **ເກົ່າ** 3,792 ໃບຍັງຫວ່າງ (migration ບໍ່ backfill ເພາະຈະເປັນການເດົາ)
   * ⇒ ໜ້ານີ້ຄືບ່ອນທີ່ຄ່ອຍໆເຕີມໃສ່ໃບທີ່ຍັງເປີດຢູ່.
   */
  /**
   * ── ປະເພດງານ: ສ້ອມ / ເຄມ ── (ຄືກັບຟອມເປີດງານ src/components/service-form.tsx)
   * ແຕ່ກ່ອນໝາຍໄດ້ແຕ່**ຕອນເປີດງານ** ⇒ ຮ້ານຄ້າມາບອກພາຍຫຼັງວ່າ "ອັນນີ້ຂໍເຄມອາໄຫຼ່"
   * ຕ້ອງຍົກເລີກໃບແລ້ວເປີດໃໝ່. ດຽວນີ້ໝາຍຢູ່ໜ້າແກ້ໄຂໄດ້ ແລະ server ຈະສ້າງໃບເຄມ
   * CLM-B ໃຫ້ຄືກັນກັບຕອນເປີດງານ (ເບິ່ງ updateService).
   * ມີໃບເຄມຜູກແລ້ວ ⇒ ປ່ຽນກັບເປັນ "ງານສ້ອມ" ບໍ່ໄດ້ (ຕ້ອງຈັດການທີ່ໃບເຄມ).
   */
  const [jobKind, setJobKind] = useState<"repair" | "claim">(head.job_kind === "claim" ? "claim" : "repair");
  const [claimScope, setClaimScope] = useState<"whole" | "part">(head.claim_scope === "part" ? "part" : "whole");
  const claimLocked = Boolean(head.claim_no);

  const [serviceType, setServiceType] = useState(head.service_type ?? "");
  const [intakeCenter, setIntakeCenter] = useState(head.intake_center ?? "");
  const onsite = ONSITE_SERVICE_TYPES.includes(serviceType as "IH" | "PS");

  /**
   * ໝາຍເປັນງານເຄມ ⇒ ຕັ້ງປະເພດບໍລິການເປັນ CI ໃຫ້ (ຄືກັບຟອມເປີດງານ — ເບິ່ງເຫດຜົນຢູ່ນັ້ນ).
   * ແຕະສະເພາະເມື່ອຊ່ອງຫວ່າງ ຫຼື ເປັນປະເພດອອກໜ້າງານ (IH/PS) ທີ່ບັງຄັບສະຖານທີ່.
   */
  const pickClaim = () => {
    setJobKind("claim");
    if (!serviceType || ONSITE_SERVICE_TYPES.includes(serviceType as "IH" | "PS")) setServiceType("CI");
  };

  const [point, setPoint] = useState<Point | null>(
    head.location_lat != null && head.location_lng != null
      ? { lat: head.location_lat, lng: head.location_lng }
      : null,
  );

  useEffect(() => {
    if (q.length < 2 || selected.name_1 === q) return;
    const timer = setTimeout(() => fetch(`/api/customers?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setCustomers), 250);
    return () => clearTimeout(timer);
  }, [q, selected]);

  return (
    <form action={action} className="space-y-5">
      <KeepFormValues />
      <input type="hidden" name="code" value={head.code} />

      <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? t.saving : t.save}
        </button>
        <Link href="/service" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#9f5f14] px-5 text-sm font-semibold text-white transition hover:opacity-90">
          <LogOut className="size-4" />
          {t.exit}
        </Link>
      </div>

      {state.error && <p className="rounded-lg border border-brand-orange-400 bg-brand-orange-50 p-4 text-sm text-brand-orange-700">{state.error}</p>}

      {/* ປະເພດງານ — ໂຄງດຽວກັນກັບຟອມເປີດງານ (service-form.tsx) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-bold text-slate-700">{t.jobKindLabel}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={claimLocked}
            onClick={() => setJobKind("repair")}
            className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${jobKind === "repair" ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200"}`}
          >
            <b className="block text-sm">{t.kindRepair}</b>
            <span className="text-xs text-slate-500">{t.kindRepairHint}</span>
          </button>
          <button
            type="button"
            onClick={() => pickClaim()}
            className={`rounded-xl border p-3 text-left ${jobKind === "claim" ? "border-brand-orange-500 bg-brand-orange-50 ring-2 ring-brand-orange-100" : "border-slate-200"}`}
          >
            <b className="block text-sm">{t.kindClaim}</b>
            <span className="text-xs text-slate-500">{t.kindClaimHint}</span>
          </button>
        </div>
        <input type="hidden" name="job_kind" value={jobKind} />

        {claimLocked && (
          <p className="mt-2 rounded-lg bg-brand-orange-50 px-3 py-2 text-xs font-semibold text-brand-orange-700">
            {t.claimLockedPrefix}{" "}
            <Link href={`/claims/${encodeURIComponent(head.claim_no ?? "")}`} className="underline">
              {head.claim_no}
            </Link>{" "}
            {t.claimLockedSuffix}
          </p>
        )}

        {jobKind === "claim" && (
          <div className="mt-3 rounded-xl border border-brand-orange-200 bg-brand-orange-50/50 p-3">
            <p className="mb-2 text-xs font-bold text-brand-orange-700">{t.claimScopeQuestion}</p>
            {!claimLocked && <p className="mb-2 text-[11px] text-brand-orange-700">{t.claimServiceHint}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setClaimScope("whole")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${claimScope === "whole" ? "bg-brand-orange-600 text-white" : "border border-brand-orange-200 bg-white text-brand-orange-700"}`}
              >
                {t.claimWhole}
              </button>
              <button
                type="button"
                onClick={() => setClaimScope("part")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${claimScope === "part" ? "bg-brand-orange-600 text-white" : "border border-brand-orange-200 bg-white text-brand-orange-700"}`}
              >
                {t.claimPart}
              </button>
            </div>
            <input type="hidden" name="claim_scope" value={claimScope} />
            {claimScope === "part" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {/* ອາໄຫຼ່ **ຕ້ອງມາຈາກ ERP** — ຄ່າເກົ່າທີ່ພິມເອງຍັງສະແດງ ແລະ ປ່ຽນໃໝ່ໄດ້ */}
                <ClaimPartPicker field={field} defaultCode={head.claim_part_code} defaultName={head.claim_part_name} />
                <input name="claim_part_sn" defaultValue={head.claim_part_sn} placeholder={t.claimPartSn} className={field} />
                <input
                  name="claim_part_qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={head.claim_part_qty ?? 1}
                  required
                  placeholder={t.claimPartQty}
                  className={field}
                />
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">{t.customerInfo}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <label className={label}>{t.customerCode} *</label>
            <div className="flex h-10 items-center rounded-lg border border-slate-300 px-3 focus-within:border-brand-600">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                value={q}
                onChange={(event) => { setQ(event.target.value); setCustomers([]); }}
                className="w-full px-2 text-sm outline-none"
                placeholder={t.customerSearchPlaceholder}
              />
            </div>
            {customers.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                {customers.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => { setSelected(c); setQ(c.name_1); setCustomers([]); }}
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-brand-50"
                  >
                    <b>{c.name_1}</b>
                    <span className="ml-2 text-xs text-slate-400">{c.code} · {c.tel}</span>
                  </button>
                ))}
              </div>
            )}
            <input type="hidden" name="cust_code" value={selected.code} />
          </div>
          <div>
            <label className={label}>{t.customerName} *</label>
            <input readOnly value={selected.name_1 ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>{t.tel}</label>
            <input readOnly value={selected.tel ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>{t.address}</label>
            <input readOnly value={selected.address ?? ""} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">{t.storeBillInfo}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* ຊ່ອງ "ລະຫັດຮ້ານຄ້າ" ຖືກຖອດ — ຄືລະຫັດລູກຄ້າອັນດຽວກັນ (server ຂຽນ ap_code ໃຫ້) */}
          <div>
            <label className={label}>{t.billNo}</label>
            <input name="billon" defaultValue={head.doc_def ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>{t.billDate}</label>
            <input name="billdate" defaultValue={head.doc_date_ref ?? ""} className={field} placeholder="YYYY-MM-DD" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">{t.productInfo}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className={label}>{t.productName} *</label>
            <input name="proname" required defaultValue={head.name_1 ?? ""} className={field} />
          </div>
          <div className="xl:col-span-2">
            <label className={label}>Serial Number (SN)</label>
            <input name="pro_sn" defaultValue={head.sn ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>Model *</label>
            <input name="pro_model" required defaultValue={head.p_model ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>{t.productType} *</label>
            <SelectField
              name="pro_type"
              defaultValue={head.p_type ?? ""}
              options={types.map((x) => ({ value: x.code, label: x.name_1 }))}
              placeholder={t.searchTypePlaceholder}
            />
          </div>
          <div>
            <label className={label}>{t.brand} *</label>
            <BrandField brands={brands} value={brand} onChange={setBrand} />
          </div>
          <div>
            <label className={label}>{t.accessories}</label>
            <input name="pro_acc" defaultValue={head.p_access ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>{t.warrantyLabel} *</label>
            <SelectField
              name="pro_wa"
              defaultValue={head.warrunty ?? "ຮັບປະກັນ"}
              options={[
                { value: "ຮັບປະກັນ", label: "ຮັບປະກັນ" },
                { value: "ໝົດຮັບປະກັນ", label: "ໝົດຮັບປະກັນ" },
              ]}
            />
          </div>
          <div>
            <label className={label}>{t.deliveryLabel} *</label>
            <SelectField
              name="pro_deli"
              defaultValue={head.p_delivery ?? "2"}
              options={[
                { value: "1", label: t.deliveryByOdien },
                { value: "2", label: t.deliveryPickup },
              ]}
            />
          </div>
          <div>
            <label className={label}>{t.serviceTypeLabel} *</label>
            <SelectField
              name="service_type"
              value={serviceType}
              onChange={(value) => {
                setServiceType(value);
                if (value !== "CI") setIntakeCenter("");
              }}
              options={[
                { value: "CI", label: t.serviceTypeCI },
                { value: "PS", label: t.serviceTypePS },
                { value: "IH", label: t.serviceTypeIH },
                { value: "ST", label: t.serviceTypeST },
              ]}
            />
          </div>

          {/* ບ່ອນຮັບເຄື່ອງ — ສະເພາະ CI (ເບິ່ງເຫດຜົນຢູ່ service-form) · ແກ້ໄດ້ຖ້າເລືອກຜິດຕອນຮັບ */}
          {serviceType === "CI" && (
            <div>
              <label className={label}>{t.intakeCenterLabel}</label>
              <SelectField
                name="intake_center"
                value={intakeCenter}
                onChange={setIntakeCenter}
                placeholder={t.intakeCenterPlaceholder}
                options={REPAIR_CENTERS.map((code) => ({ value: code, label: REPAIR_CENTER_LABEL[code] }))}
              />
            </div>
          )}

          {/* ນອກສະຖານທີ່ ⇒ ຕ້ອງຮູ້ວ່າໄປໃສ ແລະ ໄປມື້ໃດ (CI/ST ເຮັດຢູ່ສູນ ບໍ່ຂຶ້ນ) */}
          {onsite && (
            <>
              <div className="md:col-span-2">
                <label className={label}>{t.siteLocation} *</label>
                <input
                  name="location_repair"
                  required
                  defaultValue={head.location_repair || head.address}
                  placeholder={t.siteLocationPlaceholder}
                  className={field}
                />
                <p className="mt-1 text-xs text-slate-400">
                  {t.siteLocationNote}
                </p>
                <LocationPicker value={point} onChange={setPoint} />
                <input type="hidden" name="location_lat" value={point ? String(point.lat) : ""} />
                <input type="hidden" name="location_lng" value={point ? String(point.lng) : ""} />
              </div>
              <div>
                <label className={label}>{t.appointDate}</label>
                <input type="date" name="appoint_date" defaultValue={head.appoint_date} className={field} />
              </div>
            </>
          )}
          {/* ວັນເວລາຮັບເຄື່ອງ — ແກ້ໄດ້ ເພາະບາງໃບຄີຍ້ອນຫຼັງ (ຮັບໜ້າເຄົາເຕີແລ້ວຄ່ອຍມາຄີ) */}
          <div>
            <label className={label}>{t.receivedAt}</label>
            <input type="datetime-local" name="time_register" defaultValue={head.time_register} className={field} />
          </div>
          <div>
            <label className={label}>{t.tech} *</label>
            <SelectField
              name="emp"
              defaultValue={head.emp_code ?? ""}
              options={techs.map((x) => ({ value: x.username, label: x.username }))}
              placeholder={t.searchTechPlaceholder}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>{t.initialSymptom} *</label>
            <input name="pro_issue" required defaultValue={head.issue ?? ""} className={field} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>{t.remark}</label>
            <input name="pro_remark" defaultValue={head.p_abrasion ?? ""} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">{t.productPhotos}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["file1", "file2", "file3", "file4"].map((name, index) => (
            <ImageSlot key={name} name={name} index={index} current={images[index]} t={t} />
          ))}
        </div>
      </section>
    </form>
  );
}
