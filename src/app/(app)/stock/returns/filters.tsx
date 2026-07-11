"use client";
import { SelectField } from "@/components/select-field";
import { Search } from "lucide-react";
import { useRef, useState } from "react";

/** ປະເພດວຽກຂອງໃບເບີກ — ic_trans.job_type ('install' = ງານຕິດຕັ້ງ, ວ່າງ = ງານສ້ອມແປງ) */
const JOB_OPTIONS = [
  { value: "repair", label: "ງານສ້ອມແປງ" },
  { value: "install", label: "ງານຕິດຕັ້ງ" },
];

/** ຄົ້ນຫາ + ກັ່ນຕອງປະເພດວຽກ — ເລືອກແລ້ວສົ່ງຟອມເລີຍ */
export function ReturnFilters({
  q,
  job,
  tab,
  sort,
  dir,
  placeholder,
  showJob,
}: {
  q: string;
  job: string;
  tab: string;
  sort: string;
  dir: string;
  placeholder: string;
  /** ແທັບ "ການເຄື່ອນໃຫວ" ບໍ່ມີປະເພດວຽກ (ອ່ານຈາກ tb_product ເຊິ່ງເປັນງານສ້ອມແປງທັງໝົດ) */
  showJob: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [current, setCurrent] = useState(job);

  return (
    <form ref={formRef} className="flex flex-1 flex-wrap items-center gap-2">
      {tab !== "dispatched" && <input type="hidden" name="tab" value={tab} />}
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="dir" value={dir} />

      <div className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
        <Search className="size-3.5 shrink-0 text-slate-400" />
        <input name="q" defaultValue={q} placeholder={placeholder} className="w-full text-xs outline-none" />
      </div>

      {showJob && (
        <div className="min-w-44 text-xs">
          <SelectField
            name="job"
            options={JOB_OPTIONS}
            value={current}
            onChange={(value) => {
              setCurrent(value);
              // ລໍຖ້າໃຫ້ hidden input ຮັບຄ່າໃໝ່ກ່ອນຈຶ່ງສົ່ງຟອມ
              setTimeout(() => formRef.current?.requestSubmit(), 0);
            }}
            placeholder="ທຸກປະເພດວຽກ"
          />
        </div>
      )}

      <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-medium text-white">ຄົ້ນຫາ</button>
    </form>
  );
}
