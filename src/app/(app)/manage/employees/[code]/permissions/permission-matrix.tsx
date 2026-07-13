"use client";

import { saveEmployeePermissions } from "@/app/actions/permission";
import { PERMISSION_ACTION_LABEL, type CrudPermission, type PermissionAction } from "@/lib/permission-catalog";
import { CircleCheck, LoaderCircle, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

export type PermissionMatrixRow = {
  group: string;
  label: string;
  resource: string;
  actions: PermissionAction[];
  inherit: boolean;
  permission: CrudPermission;
};

function normalize(row: PermissionMatrixRow, permission: CrudPermission): CrudPermission {
  const supported = new Set(row.actions);
  const read = permission.read;
  return {
    read,
    create: read && supported.has("create") && permission.create,
    update: read && supported.has("update") && permission.update,
    delete: read && supported.has("delete") && permission.delete,
  };
}

export function PermissionMatrix({ employeeCode, initialRows }: { employeeCode: string; initialRows: PermissionMatrixRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const groups = useMemo(() => [...new Set(rows.map((row) => row.group))], [rows]);

  function customize(index: number) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, inherit: false } : row)));
  }

  function inherit(index: number) {
    const original = initialRows[index];
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...original, inherit: true, permission: original.permission } : row)),
    );
  }

  function toggle(index: number, action: PermissionAction) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row.permission, [action]: !row.permission[action] };
        if (action === "read" && !next.read) {
          next.create = false;
          next.update = false;
          next.delete = false;
        }
        if (action !== "read" && next[action]) next.read = true;
        return { ...row, inherit: false, permission: normalize(row, next) };
      }),
    );
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveEmployeePermissions({
        employeeCode,
        entries: rows.map((row) => ({ resource: row.resource, inherit: row.inherit, ...row.permission })),
      });
      setMessage(result.error ? { tone: "error", text: result.error } : { tone: "ok", text: result.ok ?? "ບັນທຶກແລ້ວ" });
      if (!result.error) setRows((current) => current.map((row) => ({ ...row })));
    });
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div>
          <p className="text-sm font-bold text-slate-700">ສິດເຂົ້າເມນູ ແລະ CRUD</p>
          <p className="text-xs text-slate-500">ຖ້າເລືອກ “ຕາມ role” ລະບົບຈະໃຊ້ສິດກຸ່ມເກົ່າອັດຕະໂນມັດ</p>
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span className={`text-xs font-semibold ${message.tone === "ok" ? "text-emerald-700" : "text-red-600"}`}>
              {message.tone === "ok" && <CircleCheck className="mr-1 inline size-4" />}
              {message.text}
            </span>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-teal-600 px-4 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            ບັນທຶກສິດ
          </button>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <SlidersHorizontal className="size-4 text-teal-600" />
            <h2 className="text-sm font-bold text-slate-700">{group}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-4 py-2 font-semibold">ເມນູ</th>
                  <th className="w-32 px-3 py-2 text-center font-semibold">ຮູບແບບ</th>
                  {(["read", "create", "update", "delete"] as PermissionAction[]).map((action) => (
                    <th key={action} className="w-20 px-2 py-2 text-center font-semibold">
                      {PERMISSION_ACTION_LABEL[action]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  if (row.group !== group) return null;
                  return (
                    <tr key={row.resource} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <span className="block font-semibold text-slate-700">{row.label}</span>
                        <span className="text-[10px] text-slate-400">{row.resource}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {row.inherit ? (
                          <button
                            type="button"
                            onClick={() => customize(index)}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-teal-50 hover:text-teal-700"
                          >
                            ຕາມ role
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => inherit(index)}
                            className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-700 hover:bg-slate-100"
                          >
                            <RotateCcw className="size-3" /> ກຳນົດເອງ
                          </button>
                        )}
                      </td>
                      {(["read", "create", "update", "delete"] as PermissionAction[]).map((action) => {
                        const supported = row.actions.includes(action);
                        return (
                          <td key={action} className="px-2 py-2.5 text-center">
                            {supported ? (
                              <input
                                type="checkbox"
                                checked={row.permission[action]}
                                onChange={() => toggle(index, action)}
                                className={`size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 ${row.inherit ? "opacity-55" : ""}`}
                                aria-label={`${row.label} ${PERMISSION_ACTION_LABEL[action]}`}
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
