"use client";
import { assignTech } from "@/app/actions/installation";
import { SelectField } from "@/components/select-field";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** ຖອດແບບຈາກ ods: assign_tech.html modal + /assign_tech_submit */

export type AssignRow = {
  code: string;
  customer: string | null;
  location_inst: string | null;
  appoint_date: string | null;
  remark: string | null;
};

type Tech = { code: string; username: string };

export function AssignTechButton({ row, techs }: { row: AssignRow; techs: Tech[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = (formData: FormData) =>
    start(async () => {
      const result = await assignTech({}, formData);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });

  return (
    <>
      <Button
        type="button"
        tone="primary"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        ເລືອກຊ່າງ
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form action={submit} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <h2 className="font-bold text-slate-700">ເລືອກຊ່າງຕິດຕັ້ງ ເເລະ ປ້ອນລາຍລະອຽດ ({row.code})</h2>
            {error && <ErrorBox>{error}</ErrorBox>}
            <input type="hidden" name="code" value={row.code} />

            <div>
              <label className={labelClass}>ລູກຄ້າ</label>
              <input readOnly value={row.customer ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ຊ່າງ</label>
              <SelectField
                name="tech_code"
                options={techs.map((tech) => ({ value: tech.username, label: tech.username }))}
                placeholder="ເລືອກຊ່າງ..."
              />
            </div>
            <div>
              <label className={labelClass}>ວັນທີນັດຕິດຕັ້ງ</label>
              <input type="date" name="appoint_date" defaultValue={row.appoint_date ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ສະຖານທີ່ຕິດຕັ້ງ</label>
              <input name="location_inst" defaultValue={row.location_inst ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ໝາຍເຫດ</label>
              <input name="remark" defaultValue={row.remark ?? ""} className={inputClass} />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" tone="neutral" onClick={() => setOpen(false)}>ອອກ</Button>
              <Button type="submit" tone="success" disabled={pending}>ບັນທຶກ</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
