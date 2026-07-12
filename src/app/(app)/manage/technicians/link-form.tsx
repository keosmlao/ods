"use client";
import { type Employee, linkTechnician, type TechRow } from "@/app/actions/user-link";
import { Button, inputClass } from "@/components/ui";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { useActionState, useState } from "react";

/**
 * ຈັບຄູ່ຜູ້ໃຊ້ ODS ↔ ພະນັກງານ ERP.
 *
 * ຄຳແນະນຳ (suggestion) ເປັນພຽງການ **ເດົາ** ຈາກຊື່ຫຼິ້ນ — ຜູ້ຈັດການຕ້ອງຢືນຢັນເອງ
 * ເພາະນີ້ຕັດສິນວ່າ **ເງິນເຂົ້າບັນຊີໃຜ**.
 */
export function LinkRow({ row, employees }: { row: TechRow; employees: Employee[] }) {
  const [state, action, pending] = useActionState(linkTechnician, {});
  const [selected, setSelected] = useState(row.employee_code ?? "");

  const suggested = row.suggestion ? employees.find((employee) => employee.code === row.suggestion) : null;

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
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="user_code" value={row.user_code} />
          <select
            name="employee_code"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className={`${inputClass} min-w-64`}
          >
            <option value="">— ຍັງບໍ່ເຊື່ອມ (ເງິນຈະບໍ່ເຂົ້າບັນຊີ ERP) —</option>
            {employees.map((employee) => (
              <option key={employee.code} value={employee.code}>
                {employee.name}
                {employee.nickname ? ` · ${employee.nickname}` : ""} ({employee.code})
              </option>
            ))}
          </select>

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

          <Button tone="neutral" disabled={pending} className="h-8 px-3 text-xs">
            {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            ບັນທຶກ
          </Button>

          {state.error && <span className="text-xs font-semibold text-red-600">{state.error}</span>}
          {state.ok && <span className="text-xs font-semibold text-emerald-600">✓</span>}
        </form>
      </td>
    </tr>
  );
}
