"use client";
import { updateService } from "@/app/actions/service";
import { LocationPicker, type Point } from "@/components/installation/location-picker";
import { SelectField } from "@/components/select-field";
import { ONSITE_SERVICE_TYPES } from "@/lib/sla";
import { BrandField } from "@/components/service-brand-field";
import { LoaderCircle, LogOut, Save, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

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
  appoint_date: string;
  location_lat: number | null;
  location_lng: number | null;
};

const field = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 read-only:bg-slate-50";
const label = "mb-1 block text-sm text-slate-600";

/** ຮູບ 1 ຊ່ອງ — ສະແດງຮູບເກົ່າ ແລະເລືອກຮູບໃໝ່ໄດ້ (ຮູບໃໝ່ຈະຖືກເພີ່ມເຂົ້າ ຄື update_rcpro ຂອງ ods) */
function ImageSlot({ name, index, current }: { name: string; index: number; current?: string }) {
  const [preview, setPreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const shown = preview || (current ? `/api/uploads/${encodeURIComponent(current)}` : "");

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-3">
      <p className="mb-2 text-xs font-medium text-slate-500">ຮູບທີ {index + 1}</p>
      <div className="mb-2 grid h-28 place-items-center overflow-hidden rounded bg-slate-50">
        {shown ? (
          <Image src={shown} alt="" width={160} height={112} unoptimized className="size-full object-cover" />
        ) : (
          <span className="text-xs text-slate-400">ບໍ່ມີຮູບ</span>
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
          className="mt-2 text-xs text-red-600 hover:underline"
        >
          ເອົາຮູບອອກ
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
  const [serviceType, setServiceType] = useState(head.service_type ?? "");
  const onsite = ONSITE_SERVICE_TYPES.includes(serviceType as "IH" | "PS");
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
      <input type="hidden" name="code" value={head.code} />

      <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
        </button>
        <Link href="/service" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#DE3163] px-5 text-sm font-semibold text-white transition hover:opacity-90">
          <LogOut className="size-4" />
          ອອກ
        </Link>
      </div>

      {state.error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{state.error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຂໍ້ມູນລູກຄ້າ</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <label className={label}>ລະຫັດລູກຄ້າ *</label>
            <div className="flex h-10 items-center rounded-lg border border-slate-300 px-3 focus-within:border-teal-500">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                value={q}
                onChange={(event) => { setQ(event.target.value); setCustomers([]); }}
                className="w-full px-2 text-sm outline-none"
                placeholder="ຊື່, ລະຫັດ ຫຼືເບີໂທ"
              />
            </div>
            {customers.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                {customers.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => { setSelected(c); setQ(c.name_1); setCustomers([]); }}
                    className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-teal-50"
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
            <label className={label}>ຊື່ລູກຄ້າ *</label>
            <input readOnly value={selected.name_1 ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>ເບີໂທ</label>
            <input readOnly value={selected.tel ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>ທີ່ຢູ່</label>
            <input readOnly value={selected.address ?? ""} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຂໍ້ມູນຮ້ານຄ້າ / ບິນຊື້</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* ຊ່ອງ "ລະຫັດຮ້ານຄ້າ" ຖືກຖອດ — ຄືລະຫັດລູກຄ້າອັນດຽວກັນ (server ຂຽນ ap_code ໃຫ້) */}
          <div>
            <label className={label}>ເລກທີບິນ</label>
            <input name="billon" defaultValue={head.doc_def ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>ວັນທີບິນ</label>
            <input name="billdate" defaultValue={head.doc_date_ref ?? ""} className={field} placeholder="YYYY-MM-DD" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຂໍ້ມູນສິນຄ້າ</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className={label}>ຊື່ເຄື່ອງ *</label>
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
            <label className={label}>ປະເພດສິນຄ້າ *</label>
            <SelectField
              name="pro_type"
              defaultValue={head.p_type ?? ""}
              options={types.map((x) => ({ value: x.code, label: x.name_1 }))}
              placeholder="ຄົ້ນຫາປະເພດ..."
            />
          </div>
          <div>
            <label className={label}>ຫຍີ່ຫໍ້ *</label>
            <BrandField brands={brands} value={brand} onChange={setBrand} />
          </div>
          <div>
            <label className={label}>ອຸປະກອນທີ່ນຳມາ</label>
            <input name="pro_acc" defaultValue={head.p_access ?? ""} className={field} />
          </div>
          <div>
            <label className={label}>ການຮັບປະກັນ *</label>
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
            <label className={label}>ການຈັດສົ່ງ *</label>
            <SelectField
              name="pro_deli"
              defaultValue={head.p_delivery ?? "2"}
              options={[
                { value: "1", label: "ໂອດ້ຽນຈັດສົ່ງ" },
                { value: "2", label: "ລູກຄ້າຮັບເອງ" },
              ]}
            />
          </div>
          <div>
            <label className={label}>ປະເພດບໍລິການ *</label>
            <SelectField
              name="service_type"
              value={serviceType}
              onChange={setServiceType}
              options={[
                { value: "CI", label: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ" },
                { value: "PS", label: "ໄປຮັບບ້ານລູກຄ້າ" },
                { value: "IH", label: "ສ້ອມບ້ານລູກຄ້າ" },
                { value: "ST", label: "ສ້ອມເຄື່ອງໃນສາງ" },
              ]}
            />
          </div>

          {/* ນອກສະຖານທີ່ ⇒ ຕ້ອງຮູ້ວ່າໄປໃສ ແລະ ໄປມື້ໃດ (CI/ST ເຮັດຢູ່ສູນ ບໍ່ຂຶ້ນ) */}
          {onsite && (
            <>
              <div className="md:col-span-2">
                <label className={label}>ສະຖານທີ່ໜ້າງານ *</label>
                <input
                  name="location_repair"
                  required
                  defaultValue={head.location_repair || head.address}
                  placeholder="ບ້ານ / ເມືອງ / ຈຸດສັງເກດ"
                  className={field}
                />
                <p className="mt-1 text-xs text-slate-400">
                  ໃບເກົ່າຍັງບໍ່ມີຄ່ານີ້ — ຕື່ມມາຈາກທີ່ຢູ່ລູກຄ້າໃຫ້ກ່ອນ ແກ້ໄດ້
                </p>
                <LocationPicker value={point} onChange={setPoint} />
                <input type="hidden" name="location_lat" value={point ? String(point.lat) : ""} />
                <input type="hidden" name="location_lng" value={point ? String(point.lng) : ""} />
              </div>
              <div>
                <label className={label}>ວັນນັດເຂົ້າສ້ອມ</label>
                <input type="date" name="appoint_date" defaultValue={head.appoint_date} className={field} />
              </div>
            </>
          )}
          <div>
            <label className={label}>ຊ່າງ *</label>
            <SelectField
              name="emp"
              defaultValue={head.emp_code ?? ""}
              options={techs.map((x) => ({ value: x.username, label: x.username }))}
              placeholder="ຄົ້ນຫາຊ່າງ..."
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>ອາການເບື້ອງຕົ້ນ *</label>
            <input name="pro_issue" required defaultValue={head.issue ?? ""} className={field} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>ໝາຍເຫດ</label>
            <input name="pro_remark" defaultValue={head.p_abrasion ?? ""} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ເພີ່ມຮູບພາບສິນຄ້າ</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["file1", "file2", "file3", "file4"].map((name, index) => (
            <ImageSlot key={name} name={name} index={index} current={images[index]} />
          ))}
        </div>
      </section>
    </form>
  );
}
