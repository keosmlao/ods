"use client";
import { type Employee, linkTechnician, type TechRow } from "@/app/actions/user-link";
import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui";
import { setTechCenter } from "@/app/actions/job-transfer";
import { REPAIR_CENTER_LABEL, REPAIR_CENTERS } from "@/lib/repair-center";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";

/**
 * ຈັບຄູ່ຜູ້ໃຊ້ ODS ↔ ພະນັກງານ ERP.
 *
 * ຄຳແນະນຳ (suggestion) ເປັນພຽງການ **ເດົາ** ຈາກຊື່ຫຼິ້ນ — ຜູ້ຈັດການຕ້ອງຢືນຢັນເອງ
 * ເພາະນີ້ຕັດສິນວ່າ **ເງິນເຂົ້າບັນຊີໃຜ** ແລະ ດຽວນີ້ຍັງ **ຂຽນລະຫັດ ERP ທັບຂໍ້ມູນເກົ່າ**
 * ຂອງຄົນນັ້ນທຸກຕາຕະລາງ (actions/user-link) ⇒ ຕ້ອງຢືນຢັນກ່ອນບັນທຶກ.
 *
 * dropdown ໃຊ້ react-select (components/select-field) — ພະນັກງານມີຫຼາຍສິບຄົນ
 * ⇒ ຕ້ອງພິມຄົ້ນຫາໄດ້ ບໍ່ແມ່ນເລື່ອນຫາເອງ.
 */
export function LinkRow({ row, employees }: { row: TechRow; employees: Employee[] }) {
  const [state, action, pending] = useActionState(linkTechnician, {});
  const [selected, setSelected] = useState(row.employee_code ?? "");
  const [confirming, setConfirming] = useState(false);
  /** ສູນຂອງຊ່າງ — ບັນທຶກທັນທີທີ່ເລືອກ (ຄ່າດຽວ ບໍ່ຕ້ອງມີປຸ່ມຢືນຢັນ) */
  const router = useRouter();
  const [center, setCenter] = useState(row.center ?? "");
  const [savingCenter, startCenter] = useTransition();

  const suggested = row.suggestion ? employees.find((employee) => employee.code === row.suggestion) : null;
  const options = employees.map((employee) => ({
    value: employee.code,
    label: `${employee.name}${employee.nickname ? ` · ${employee.nickname}` : ""} (${employee.code})`,
  }));

  // ຄ່າໃນງານເປັນລະຫັດ ERP ຢູ່ແລ້ວ ⇒ ບໍ່ມີຫຍັງໃຫ້ຍ້າຍ (ບັນທຶກຄູ່ໄວ້ຢ່າງດຽວ)
  const willMove = selected && selected !== row.user_code && selected !== row.employee_code;

  return (
    <tr className={`border-b border-slate-100 ${row.employee_code ? "" : "bg-amber-50/50"}`}>
      <td className="whitespace-nowrap px-3 py-2 text-xs font-bold text-slate-800">
        {row.user_code}
        {row.ods_name && row.ods_name !== row.user_code && (
          <span className="ml-1 font-normal text-slate-400">({row.ods_name})</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{row.jobs.toLocaleString()}</td>

      <td className="px-3 py-2">
        <form action={action} className="space-y-2">
          <input type="hidden" name="user_code" value={row.user_code} />

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-64 flex-1">
              <SelectField
                name="employee_code"
                value={selected}
                onChange={(value) => {
                  setSelected(value);
                  setConfirming(false);
                }}
                options={options}
                placeholder="— ຍັງບໍ່ເຊື່ອມ (ເງິນຈະບໍ່ເຂົ້າບັນຊີ ERP) —"
              />
            </div>

            {/* ຄຳແນະນຳ — ກົດແລ້ວຕື່ມໃຫ້ ແຕ່ຍັງຕ້ອງກົດບັນທຶກ (ບໍ່ບັນທຶກເອງ) */}
            {!row.employee_code && suggested && selected !== suggested.code && (
              <button
                type="button"
                onClick={() => setSelected(suggested.code)}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                title="ນີ້ເປັນພຽງການເດົາຈາກຊື່ຫຼິ້ນ — ກະລຸນາກວດກ່ອນບັນທຶກ"
              >
                <Sparkles className="size-3" />
                ນ່າຈະແມ່ນ {suggested.nickname ?? suggested.name}
              </button>
            )}

            {/*
              ຂຽນທັບຂໍ້ມູນຈິງເປັນພັນແຖວ ⇒ ຖາມກ່ອນ 1 ຈັງຫວະ.
              ບໍ່ຢືນຢັນ = ປຸ່ມ submit ບໍ່ຂຶ້ນ ⇒ ກົດຜິດແລ້ວຍ້າຍໄປເລີຍບໍ່ໄດ້.
            */}
            {willMove && !confirming ? (
              <Button type="button" tone="neutral" onClick={() => setConfirming(true)} className="h-8 px-3 text-xs">
                <Check className="size-3.5" />
                ບັນທຶກ
              </Button>
            ) : (
              <Button tone={willMove ? "danger" : "neutral"} disabled={pending} className="h-8 px-3 text-xs">
                {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                {willMove ? "ຢືນຢັນ ຍ້າຍຂໍ້ມູນ" : "ບັນທຶກ"}
              </Button>
            )}

            {state.error && <span className="text-xs font-semibold text-red-600">{state.error}</span>}
            {state.ok && <span className="text-xs font-semibold text-emerald-600">{state.ok}</span>}
          </div>

          {willMove && confirming && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-800">
              ຈະຂຽນລະຫັດ <b>{selected}</b> ທັບຊື່ <b>{row.user_code}</b> ໃນທຸກຕາຕະລາງ (ງານ {row.jobs.toLocaleString()} ງານ
              ພ້ອມ ຮູບ · check-in · ຄ່າຄອມ · ຂ່າວສານ · ເອກະສານສາງ) — ຫຼັງຈາກນີ້ ລາວຈະໃຊ້ <b>ລະຫັດ ERP</b> ເຂົ້າລະບົບ
              ແລະ ເຫັນງານເກົ່າຄົບຄືເກົ່າ.
            </p>
          )}
        </form>
      </td>
      {/*
        ── ສູນຂອງຊ່າງ ──
        ຕັ້ງແລ້ວ: ຈັດຊ່າງຄົນລະສູນກັບເຄື່ອງ ⇒ ລະບົບ**ສ້າງໃບໂອນໃຫ້ອັດຕະໂນມັດ** (actions/repair)
        ຫວ່າງ: ບໍ່ໂອນໃຫ້ (ພຶດຕິກຳເກົ່າ) — ຕ້ອງກົດ "ໂອນ" ເອງຢູ່ໜ້າໃບງານ.
      */}
      <td className="whitespace-nowrap px-3 py-2">
        <select
          value={center}
          disabled={savingCenter}
          onChange={(event) => {
            const value = event.target.value;
            setCenter(value);
            startCenter(async () => {
              await setTechCenter(row.user_code, value);
              router.refresh();
            });
          }}
          className="h-8 rounded-lg border border-slate-300 px-2 text-xs outline-none focus:border-teal-500 disabled:opacity-60"
        >
          <option value="">— ບໍ່ລະບຸ —</option>
          {REPAIR_CENTERS.map((code) => (
            <option key={code} value={code}>
              {REPAIR_CENTER_LABEL[code]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
