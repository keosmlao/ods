"use client";
import { createNotice } from "@/app/actions/notice";
import { SelectField } from "@/components/select-field";
import { inputClass, labelClass } from "@/components/ui";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

/**
 * ຟອມແຈ້ງສ້ອມ — ໃຊ້ຮ່ວມກັນ 2 ບ່ອນ:
 *   - mode="public" → /report-repair (ລູກຄ້າ, ບໍ່ຕ້ອງ login)
 *   - mode="sales"  → /sales/report-repair (ພະນັກງານຂາຍ)
 * ໂພສໄປ createNotice; ບັນທຶກແລ້ວໂຜ່ຢູ່ /service/notices ໃຫ້ CS ແປງເປັນໃບຮັບເຄື່ອງ.
 *
 * ແຂວງ→ເມືອງ cascade **ຢູ່ client ລ້ວນ** (ຮັບ cities ທັງໝົດມາເປັນ prop) — ບໍ່ເອີ້ນ
 * /api/cities ເພາະ route ນັ້ນ login-only ແລະ ຝັ່ງລູກຄ້າບໍ່ໄດ້ login.
 */

type Option = { code: string; name_1: string };
type City = { code: string; name_1: string; province: string };

const SERVICE_TYPES: Option[] = [
  { code: "CI", name_1: "ລູກຄ້ານຳເຄື່ອງເຂົ້າ" },
  { code: "PS", name_1: "ໄປຮັບບ້ານລູກຄ້າ" },
  { code: "IH", name_1: "ສ້ອມບ້ານລູກຄ້າ" },
  { code: "ST", name_1: "ສ້ອມເຄື່ອງໃນສາງ" },
];

function PhotoInput() {
  const [previews, setPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  return (
    <div>
      <label className={labelClass}>ຮູບເຄື່ອງ / ອາການເສຍ (ບໍ່ບັງຄັບ · ສູງສຸດ 4 ຮູບ)</label>
      <input
        ref={inputRef}
        type="file"
        name="photos"
        accept="image/*"
        multiple
        onChange={(event) => {
          previews.forEach((url) => URL.revokeObjectURL(url));
          const files = Array.from(event.target.files ?? []).slice(0, 4);
          setPreviews(files.map((file) => URL.createObjectURL(file)));
        }}
        className="w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
      />
      {previews.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {previews.map((url) => (
            <Image key={url} src={url} alt="" width={72} height={72} unoptimized className="size-[72px] rounded object-cover" />
          ))}
        </div>
      )}
    </div>
  );
}

export function NoticeForm({
  mode,
  provinces,
  cities,
}: {
  mode: "public" | "sales";
  provinces: Option[];
  cities: City[];
}) {
  const [state, action, pending] = useActionState(createNotice, {});
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [serviceType, setServiceType] = useState("");

  const cityOptions = useMemo(
    () => cities.filter((c) => c.province === province).map((c) => ({ value: c.code, label: c.name_1 })),
    [cities, province],
  );

  // ບັນທຶກສຳເລັດ → ໜ້າຢືນຢັນ (ລູກຄ້າ: ລິ້ງຕິດຕາມ · ຂາຍ: ແຈ້ງອີກ/ໄປຕິດຕາມ)
  if (state.code) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h2 className="mt-3 text-lg font-bold text-slate-700">ຮັບຄຳແຈ້ງສ້ອມແລ້ວ</h2>
        <p className="mt-1 text-sm text-slate-600">
          ລະຫັດຄຳແຈ້ງ: <b className="text-emerald-700">{state.code}</b>
        </p>
        <p className="mt-1 text-xs text-slate-500">ທີມງານ ODIEN ຈະຕິດຕໍ່ກັບຄືນ. ເກັບລະຫັດນີ້ໄວ້ເພື່ອຕິດຕາມ.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href={`/track/${encodeURIComponent(state.code)}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0536a9] px-5 text-sm font-semibold text-white hover:opacity-90"
          >
            ຕິດຕາມສະຖານະ
          </Link>
          {mode === "sales" && (
            <>
              <Link
                href="/sales/jobs"
                className="inline-flex h-10 items-center rounded-lg bg-slate-100 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                ໄປລາຍການງານ
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                ແຈ້ງອີກໃບ
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="mode" value={mode} />

      {state.error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{state.error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຂໍ້ມູນຜູ້ແຈ້ງ / ລູກຄ້າ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>ຊື່ລູກຄ້າ *</label>
            <input name="custname" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ເບີໂທ *</label>
            <input name="tel" required inputMode="tel" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ແຂວງ</label>
            <SelectField
              name="provine"
              value={province}
              onChange={(next) => { setProvince(next); setCity(""); }}
              placeholder="ເລືອກແຂວງ..."
              options={provinces.map((p) => ({ value: p.code, label: p.name_1 }))}
            />
          </div>
          <div>
            <label className={labelClass}>ເມືອງ</label>
            <SelectField
              name="city"
              value={city}
              onChange={setCity}
              isDisabled={!province}
              placeholder="ເລືອກເມືອງ..."
              options={cityOptions}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>ທີ່ຢູ່ (ບ້ານ / ຈຸດສັງເກດ)</label>
            <input name="address" className={inputClass} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 border-b border-slate-100 pb-2 font-bold text-slate-700">ຂໍ້ມູນເຄື່ອງ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>ຊື່ເຄື່ອງ *</label>
            <input name="proname" required placeholder="ເຊັ່ນ ແອ, ຕູ້ເຢັນ, ໂທລະທັດ" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Serial Number (SN)</label>
            <input name="pro_sn" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ຫຍີ່ຫໍ້</label>
            <input name="pro_brand" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ລຸ້ນ / Model</label>
            <input name="pro_model" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>ຮັບບໍລິການແບບ</label>
            <SelectField
              name="service_type"
              value={serviceType}
              onChange={setServiceType}
              placeholder="ເລືອກ..."
              options={SERVICE_TYPES.map((s) => ({ value: s.code, label: s.name_1 }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>ອາການເບື້ອງຕົ້ນ *</label>
            <input name="pro_issue" required placeholder="ອະທິບາຍອາການເສຍ" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>ໝາຍເຫດ</label>
            <input name="pro_remark" className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <PhotoInput />
          </div>
        </div>
      </section>

      <button
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
        {pending ? "ກຳລັງສົ່ງ..." : "ສົ່ງຄຳແຈ້ງສ້ອມ"}
      </button>
    </form>
  );
}
