"use client";
import { createServiceFromNotice } from "@/app/actions/service";
import { SelectField } from "@/components/select-field";
import { BrandField } from "@/components/service-brand-field";
import { LoaderCircle, LogOut, Save } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

type Option = { code: string; name_1: string };

export type Notice = {
  code: string;
  creator_name: string;
  telephone: string;
  name_1: string;
  sn: string;
  issue: string;
  remark: string;
  noticed: string;
  p_brand: string;
  p_model: string;
  service_type: string;
  ref_code: string;
  cust_name: string;
  cust_address: string;
};

const field = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const label = "mb-1 block text-sm text-slate-600";

/** ຮູບທີ່ລູກຄ້າແນບມາ — ຖ້າບໍ່ເລືອກຮູບໃໝ່ ຮູບເກົ່າຈະຖືກຍ້າຍມາເປັນຮູບຂອງງານ */
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

export function ServiceNoticeForm({ notice, types, brands, techs, images }: {
  notice: Notice;
  types: Option[];
  brands: Option[];
  techs: { code: string; username: string }[];
  images: Record<number, string>;
}) {
  const [state, action, pending] = useActionState(createServiceFromNotice, {});
  const [brand, setBrand] = useState(notice.p_brand);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="ref_notice" value={notice.code} />
      <input type="hidden" name="ref_cust" value={notice.ref_code} />

      <div className="sticky top-20 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
        </button>
        <Link href="/service/notices" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#DE3163] px-5 text-sm font-semibold text-white transition hover:opacity-90">
          <LogOut className="size-4" />
          ອອກ
        </Link>
        <span className="ml-auto text-sm text-slate-500">ລະຫັດເເຈ້ງສ້ອມ: <b className="text-[#0536a9]">{notice.code}</b> · {notice.noticed}</span>
      </div>

      {state.error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{state.error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຂໍ້ມູນລູກຄ້າ</h2>
        <p className="mb-3 text-xs text-slate-400">ຖ້າຍັງບໍ່ມີລູກຄ້ານີ້ໃນລະບົບ ຈະສ້າງໃຫ້ອັດຕະໂນມັດ (ar_type = online)</p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={label}>ຊື່ລູກຄ້າ *</label>
            <input name="custname" required defaultValue={notice.cust_name || notice.creator_name} className={field} />
          </div>
          <div>
            <label className={label}>ເບີໂທ</label>
            <input name="tel" defaultValue={notice.telephone} className={field} />
          </div>
          <div>
            <label className={label}>ທີ່ຢູ່</label>
            <input name="address" defaultValue={notice.cust_address} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຂໍ້ມູນຮ້ານຄ້າ / ບິນຊື້</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className={label}>ລະຫັດຮ້ານຄ້າ</label>
            <input name="sup_id" className={field} />
          </div>
          <div>
            <label className={label}>ຊື່ຮ້ານຄ້າ</label>
            <input name="sup_name" className={field} />
          </div>
          <div>
            <label className={label}>ເລກທີບິນ</label>
            <input name="billon" className={field} />
          </div>
          <div>
            <label className={label}>ວັນທີບິນ</label>
            <input name="billdate" type="date" className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຂໍ້ມູນສິນຄ້າ</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className={label}>ຊື່ເຄື່ອງ *</label>
            <input name="proname" required defaultValue={notice.name_1} className={field} />
          </div>
          <div className="xl:col-span-2">
            <label className={label}>Serial Number (SN)</label>
            <input name="pro_sn" defaultValue={notice.sn} className={field} />
          </div>
          <div>
            <label className={label}>Model *</label>
            <input name="pro_model" required defaultValue={notice.p_model} className={field} />
          </div>
          <div>
            <label className={label}>ປະເພດສິນຄ້າ *</label>
            <SelectField
              name="pro_type"
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
            <input name="pro_acc" className={field} />
          </div>
          <div>
            <label className={label}>ການຮັບປະກັນ *</label>
            <SelectField
              name="pro_wa"
              defaultValue="ຮັບປະກັນ"
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
              defaultValue="2"
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
              defaultValue={notice.service_type || ""}
              options={[
                { value: "CI", label: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ" },
                { value: "PS", label: "ໄປຮັບບ້ານລູກຄ້າ" },
                { value: "IH", label: "ສ້ອມບ້ານລູກຄ້າ" },
                { value: "ST", label: "ສ້ອມເຄື່ອງໃນສາງ" },
              ]}
            />
          </div>
          <div>
            <label className={label}>ຊ່າງ *</label>
            <SelectField
              name="emp"
              options={techs.map((x) => ({ value: x.username, label: x.username }))}
              placeholder="ຄົ້ນຫາຊ່າງ..."
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>ອາການເບື້ອງຕົ້ນ *</label>
            <input name="pro_issue" required defaultValue={notice.issue} className={field} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>ໝາຍເຫດ</label>
            <input name="pro_remark" defaultValue={notice.remark} className={field} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຮູບພາບສິນຄ້າ</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["file1", "file2", "file3", "file4"].map((name, index) => (
            <ImageSlot key={name} name={name} index={index} current={images[index]} />
          ))}
        </div>
      </section>
    </form>
  );
}
