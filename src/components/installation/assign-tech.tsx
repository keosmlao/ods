"use client";
import { assignTech } from "@/app/actions/installation";
import { SelectField } from "@/components/select-field";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import { CalendarDays, LoaderCircle, MapPin, StickyNote, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * ຈັດຊ່າງໃຫ້ງານຕິດຕັ້ງ (ຖອດແບບຈາກ ods: assign_tech.html modal + /assign_tech_submit).
 *
 * ── ອອກແບບໃໝ່ ──
 * ຮຸ່ນກ່ອນວາງ 5 ຊ່ອງນ້ຳໜັກເທົ່າກັນ ແລະ ເອົາ **ຊື່ລູກຄ້າໃສ່ຊ່ອງ input ທີ່ພິມບໍ່ໄດ້**
 * (readOnly) ⇒ ເບິ່ງຄືພິມໄດ້ ແຕ່ພິມບໍ່ໄດ້ ແລະ ກິນທີ່ເທົ່າຊ່ອງທີ່ຕ້ອງຕັດສິນໃຈຈິງ.
 *
 * ຄວາມຈິງ: ຜູ້ຈັດງານຕັດສິນໃຈ **2 ຢ່າງ** — ຊ່າງຄົນໃດ ແລະ ວັນໃດ.
 * ⇒ ລູກຄ້າ/ລະຫັດງານ ກາຍເປັນ **ຫົວກ່ອງ** (ຂໍ້ຄວາມ ບໍ່ແມ່ນຊ່ອງ) · ຊ່າງ ກັບ ວັນນັດ
 *   ຢູ່ເທິງສຸດ ແລະ **ວັນນັດມີປຸ່ມດ່ວນ ມື້ນີ້/ມື້ອື່ນ** (ຄ່າທີ່ໃຊ້ຫຼາຍທີ່ສຸດ) ·
 *   ສະຖານທີ່/ໝາຍເຫດ ຢູ່ລຸ່ມ (ຕື່ມມາຈາກງານແລ້ວ ສ່ວນຫຼາຍບໍ່ຕ້ອງແຕະ).
 */

export type AssignRow = {
  code: string;
  customer: string | null;
  location_inst: string | null;
  appoint_date: string | null;
  remark: string | null;
};

type Tech = { code: string; username: string };

/** ວັນທີຮູບແບບ YYYY-MM-DD ຂອງ **ມື້ນີ້ຕາມເວລາເຄື່ອງ** (ບໍ່ແມ່ນ UTC — ລາວ +7 ⇒ ຄາດເຄື່ອນ 1 ມື້ໄດ້) */
function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AssignTechButton({ row, techs }: { row: AssignRow; techs: Tech[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const [tech, setTech] = useState("");
  const [day, setDay] = useState(row.appoint_date ?? "");

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
          setTech("");
          setDay(row.appoint_date ?? "");
          setOpen(true);
        }}
      >
        ເລືອກຊ່າງ
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <form action={submit} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* ຫົວກ່ອງ = ບໍລິບົດຂອງງານ (ບໍ່ແມ່ນຊ່ອງໃຫ້ພິມ) */}
            <header className="flex items-start gap-3 border-b border-slate-100 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-600">
                <UserRound className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-slate-800">ຈັດຊ່າງໃຫ້ງານ {row.code}</h2>
                <p className="truncate text-xs text-slate-500">{row.customer ?? "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="space-y-4 p-4">
              {error && <ErrorBox>{error}</ErrorBox>}
              <input type="hidden" name="code" value={row.code} />

              {/* ① ຊ່າງ — ການຕັດສິນໃຈຫຼັກ */}
              <div>
                <label className={labelClass}>
                  <UserRound className="mr-1 inline size-3.5 text-slate-400" />
                  ຊ່າງ *
                </label>
                <SelectField
                  name="tech_code"
                  value={tech}
                  onChange={setTech}
                  options={techs.map((row) => ({ value: row.username, label: row.username }))}
                  placeholder="ພິມຊື່ຊ່າງເພື່ອຄົ້ນຫາ..."
                />
              </div>

              {/* ② ວັນນັດ — ຄ່າທີ່ໃຊ້ຫຼາຍທີ່ສຸດຄື ມື້ນີ້/ມື້ອື່ນ ⇒ ໃຫ້ກົດເອົາ ບໍ່ຕ້ອງເປີດປະຕິທິນ */}
              <div>
                <label className={labelClass}>
                  <CalendarDays className="mr-1 inline size-3.5 text-slate-400" />
                  ວັນທີນັດຕິດຕັ້ງ
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    name="appoint_date"
                    value={day}
                    onChange={(event) => setDay(event.target.value)}
                    className={`${inputClass} w-auto flex-1`}
                  />
                  {[
                    { label: "ມື້ນີ້", value: isoDate(0) },
                    { label: "ມື້ອື່ນ", value: isoDate(1) },
                  ].map((quick) => (
                    <button
                      key={quick.label}
                      type="button"
                      onClick={() => setDay(quick.value)}
                      className={`h-10 shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${
                        day === quick.value
                          ? "border-teal-500 bg-teal-50 text-teal-700"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {quick.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ③ ຕື່ມມາຈາກງານແລ້ວ — ສ່ວນຫຼາຍບໍ່ຕ້ອງແຕະ */}
              <div>
                <label className={labelClass}>
                  <MapPin className="mr-1 inline size-3.5 text-slate-400" />
                  ສະຖານທີ່ຕິດຕັ້ງ
                </label>
                <input name="location_inst" defaultValue={row.location_inst ?? ""} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>
                  <StickyNote className="mr-1 inline size-3.5 text-slate-400" />
                  ໝາຍເຫດ
                </label>
                <input
                  name="remark"
                  defaultValue={row.remark ?? ""}
                  placeholder="ຊັ້ນ, ທາງເຂົ້າ, ນັດເວລາ..."
                  className={inputClass}
                />
              </div>
            </div>

            <footer className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 p-3">
              <span className="text-[11px] text-slate-500">ຊ່າງຈະໄດ້ຮັບແຈ້ງເຕືອນເຂົ້າມືຖືທັນທີ</span>
              <div className="ml-auto flex gap-2">
                <Button type="button" tone="neutral" onClick={() => setOpen(false)} className="h-9 text-xs">
                  ອອກ
                </Button>
                {/* ບໍ່ເລືອກຊ່າງ = ບັນທຶກບໍ່ໄດ້ (server ກໍ່ປະຕິເສດຢູ່ແລ້ວ ແຕ່ຢ່າໃຫ້ຄົນກົດຜ່ານກ່ອນ) */}
                <Button type="submit" tone="success" disabled={pending || !tech} className="h-9 text-xs">
                  {pending && <LoaderCircle className="size-3.5 animate-spin" />}
                  ຈັດຊ່າງ
                </Button>
              </div>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
