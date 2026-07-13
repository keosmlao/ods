"use client";
import { saveQcRoles } from "@/app/actions/qc-admin";
import { Button, ErrorBox } from "@/components/ui";
import type { Workflow } from "@/lib/commission";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

const WORKFLOWS: { value: Workflow; label: string }[] = [
  { value: "install", label: "ຕິດຕັ້ງ" },
  { value: "repair", label: "ສ້ອມແປງ" },
];

/* ── ໃຜກວດ QC ໄດ້ ───────────────────────────────────────────────── */

export function QcRoleMatrix({ current }: { current: { workflow: Workflow; role: Role }[] }) {
  const [pairs, setPairs] = useState(current);
  const [state, setState] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();

  const has = (workflow: Workflow, role: Role) =>
    pairs.some((pair) => pair.workflow === workflow && pair.role === role);

  const toggle = (workflow: Workflow, role: Role) =>
    setPairs((list) =>
      has(workflow, role)
        ? list.filter((pair) => !(pair.workflow === workflow && pair.role === role))
        : [...list, { workflow, role }],
    );

  return (
    <div className="space-y-3">
      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && <p className="text-xs font-semibold text-emerald-700">{state.ok}</p>}

      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-3 py-2 text-left font-semibold">ຕຳແໜ່ງ</th>
              {WORKFLOWS.map((workflow) => (
                <th key={workflow.value} className="px-6 py-2 font-semibold">
                  {workflow.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.filter((role) => role !== "user").map((role) => (
              <tr key={role} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-700">{ROLE_LABEL[role]}</td>
                {WORKFLOWS.map((workflow) => (
                  <td key={workflow.value} className="px-6 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={has(workflow.value, role)}
                      onChange={() => toggle(workflow.value, role)}
                      className="size-4 accent-teal-600"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ຄົນເຮັດງານກວດຮັບຂອງຕົນເອງບໍ່ໄດ້ສະເໝີ — ບໍ່ວ່າຈະຕິກຫຍັງຢູ່ນີ້ (actions/qc.ts ບັງຄັບ) */}
      <p className="text-xs text-slate-500">
        ໝາຍເຫດ: ເຖິງຈະຕິກໃຫ້ <b>ຊ່າງ</b> ກວດໄດ້ ຊ່າງກໍ່ຍັງ <b>ກວດຮັບງານຂອງຕົນເອງບໍ່ໄດ້</b> — ຕ້ອງເປັນຄົນອື່ນກວດສະເໝີ.
      </p>

      <Button
        disabled={pending}
        onClick={() => start(async () => setState(await saveQcRoles(pairs)))}
        className="h-9 text-xs"
      >
        {pending && <LoaderCircle className="size-3.5 animate-spin" />} ບັນທຶກຜູ້ມີສິດກວດ
      </Button>
    </div>
  );
}
