"use client";
import { assignTech } from "@/app/actions/installation";
import type { Technician } from "@/lib/technicians";
import { Button, ErrorBox, inputClass, labelClass } from "@/components/ui";
import { CalendarDays, Check, LoaderCircle, MapPin, Search, StickyNote, TriangleAlert, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * ຈັດຊ່າງໃຫ້ງານຕິດຕັ້ງ (ຖອດແບບຈາກ ods: assign_tech.html modal + /assign_tech_submit).
 *
 * ── ອອກແບບໃໝ່: **ວັນກ່ອນ ແລ້ວຄ່ອຍຊ່າງ** ──
 * ຮຸ່ນກ່ອນເປັນ dropdown ລາຍຊື່ຊ່າງລ້ວນ ⇒ ຜູ້ຈັດງານ **ບໍ່ຮູ້ວ່າຊ່າງຄົນນັ້ນມື້ນັ້ນຖືກນັດຢູ່ຈັກບ່ອນແລ້ວ**
 * ⇒ ນັດຊ້ອນກັນໄດ້ ແລະ ຮູ້ຕໍ່ເມື່ອຊ່າງໂທມາຟ້ອງ.
 *
 * ດຽວນີ້:
 *   ① ເລືອກ **ວັນນັດ** ກ່ອນ (ມີປຸ່ມດ່ວນ ມື້ນີ້/ມື້ອື່ນ — ຄ່າທີ່ໃຊ້ຫຼາຍທີ່ສຸດ)
 *   ② ລາຍຊື່ຊ່າງຂຶ້ນມາເປັນ **ບັດ ພ້ອມພາລະງານຂອງມື້ນັ້ນ** (api/installations/tech-load):
 *        "ນັດມື້ນັ້ນ N ງານ" · "ຄ້າງໃນມື M ງານ" (ຕິດຕັ້ງ+ສ້ອມ)
 *        ນັດ ≥4 ບ່ອນ/ມື້ = ເປັນໄປໄດ້ຍາກ ⇒ ຂຶ້ນສີແດງ ເຕືອນກ່ອນກົດ (ບໍ່ໄດ້ຫ້າມ)
 *   ③ ສະຖານທີ່/ໝາຍເຫດ ຢູ່ລຸ່ມ — ຕື່ມມາຈາກງານແລ້ວ ສ່ວນຫຼາຍບໍ່ຕ້ອງແຕະ
 *
 * ⚠️ ງານ**ສ້ອມ**ບໍ່ມີວັນນັດໃນຖານ (tb_product ມີແຕ່ emp_code) ⇒ ນັບເປັນ "ຄ້າງໃນມື"
 * ບໍ່ແມ່ນ "ນັດມື້ນັ້ນ" — ສອງເລກນີ້ຢ່າເອົາໄປປົນກັນ.
 */

export type AssignRow = {
  code: string;
  customer: string | null;
  location_inst: string | null;
  appoint_date: string | null;
  remark: string | null;
};

type Load = { tech: string; day: number; open: number };

/** ນັດເກີນນີ້ຕໍ່ມື້ = ເປັນໄປໄດ້ຍາກ (ຄ່າດຽວກັບໜ້າ /installations/schedule) */
const BUSY = 4;

/** YYYY-MM-DD ຕາມ **ເວລາເຄື່ອງ** — ບໍ່ແມ່ນ UTC (ລາວ +7 ⇒ ຄາດເຄື່ອນ 1 ມື້ໄດ້) */
function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function AssignTechButton({ row, techs }: { row: AssignRow; techs: Technician[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const [tech, setTech] = useState("");
  const [day, setDay] = useState(row.appoint_date ?? "");
  const [q, setQ] = useState("");
  const [load, setLoad] = useState<Record<string, Load>>({});

  // ພາລະງານຂອງຊ່າງ ຂຶ້ນກັບ **ວັນທີ່ເລືອກ** ⇒ ດຶງໃໝ່ທຸກເທື່ອທີ່ປ່ຽນວັນ
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`/api/installations/tech-load?d=${encodeURIComponent(day)}`)
      .then((response) => response.json())
      .then((body: { data?: Load[] }) => {
        if (!alive) return;
        setLoad(Object.fromEntries((body.data ?? []).map((item) => [item.tech, item])));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, day]);

  const submit = (formData: FormData) =>
    start(async () => {
      const result = await assignTech({}, formData);
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });

  const shown = techs.filter((item) => `${item.name} ${item.code}`.toLowerCase().includes(q.trim().toLowerCase()));
  const chosen = tech ? load[tech] : undefined;

  return (
    <>
      <Button
        type="button"
        tone="primary"
        onClick={() => {
          setError("");
          setTech("");
          setQ("");
          setDay(row.appoint_date ?? isoDate(0));
          setOpen(true);
        }}
      >
        ເລືອກຊ່າງ
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4">
          <form
            action={submit}
            className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* ຫົວກ່ອງ = ບໍລິບົດຂອງງານ (ບໍ່ແມ່ນຊ່ອງໃຫ້ພິມ ຄືຮຸ່ນກ່ອນ) */}
            <header className="flex items-start gap-3 border-b border-slate-100 p-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-slate-800">ຈັດຊ່າງໃຫ້ງານ {row.code}</h2>
                <p className="truncate text-xs text-slate-500">
                  {row.customer ?? "-"}
                  {row.location_inst ? ` · ${row.location_inst}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-auto p-4">
              {error && <ErrorBox>{error}</ErrorBox>}
              <input type="hidden" name="code" value={row.code} />
              <input type="hidden" name="tech_code" value={tech} />

              {/* ① ວັນນັດ — ຕ້ອງມາກ່ອນ ເພາະພາລະງານຂອງຊ່າງຂຶ້ນກັບວັນ */}
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

              {/* ② ຊ່າງ — ບັດພ້ອມພາລະງານຂອງມື້ນັ້ນ (ບໍ່ແມ່ນ dropdown ຊື່ລ້ວນ) */}
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className={`${labelClass} mb-0`}>
                    <UserRound className="mr-1 inline size-3.5 text-slate-400" />
                    ຊ່າງ *
                  </label>
                  <span className="text-[11px] text-slate-400">
                    ຕົວເລກ = ງານທີ່ນັດໄວ້ໃນວັນທີ່ເລືອກ · ຄ້າງໃນມື = ຕິດຕັ້ງ+ສ້ອມທີ່ຍັງບໍ່ຈົບ
                  </span>
                </div>

                {techs.length > 6 && (
                  <div className="mb-2 flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-2.5">
                    <Search className="size-3.5 shrink-0 text-slate-400" />
                    <input
                      value={q}
                      onChange={(event) => setQ(event.target.value)}
                      placeholder="ພິມຊື່ຊ່າງ..."
                      className="w-full text-xs outline-none"
                    />
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  {shown.map((item) => {
                    const row2 = load[item.code];
                    const busy = (row2?.day ?? 0) >= BUSY;
                    const active = tech === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setTech(item.code)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                          active
                            ? "border-teal-500 bg-teal-50"
                            : busy
                              ? "border-red-200 hover:border-red-300"
                              : "border-slate-200 hover:border-teal-300"
                        }`}
                      >
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                            active ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {active ? <Check className="size-4" /> : (row2?.day ?? 0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {item.name}
                            {item.head && (
                              <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-bold text-slate-500">
                                ຫົວໜ້າຊ່າງ
                              </span>
                            )}
                          </span>
                          <span className={`block text-[11px] ${busy ? "font-semibold text-red-600" : "text-slate-500"}`}>
                            ນັດມື້ນັ້ນ {row2?.day ?? 0} ງານ · ຄ້າງໃນມື {row2?.open ?? 0}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ນັດ 4 ບ່ອນຂຶ້ນໄປໃນມື້ດຽວ = ເປັນໄປໄດ້ຍາກ ⇒ ເຕືອນ ແຕ່ບໍ່ຫ້າມ (ບາງເທື່ອບ້ານຢູ່ຕິດກັນ) */}
                {chosen && chosen.day >= BUSY && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                    ຊ່າງຄົນນີ້ຖືກນັດ {chosen.day} ບ່ອນໃນມື້ນັ້ນແລ້ວ — ແນ່ໃຈບໍ່ວ່າຈະເພີ່ມອີກ?
                  </p>
                )}
              </div>

              {/* ③ ຕື່ມມາຈາກງານແລ້ວ */}
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
                  ຈັດຊ່າງ {tech && `→ ${tech}`}
                </Button>
              </div>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
