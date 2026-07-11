"use client";
import { setEmployeeActive, setEmployeeRole } from "@/app/actions/employee";
import { useConfirm } from "@/components/confirm-dialog";
import { SelectField, type Option } from "@/components/select-field";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { Ban, CircleCheck, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ຊິ້ນສ່ວນຝັ່ງ client ຂອງໜ້າ "ກຳນົດສິດ" — dropdown ສິດ ແລະ ປຸ່ມເປີດ/ປິດການໃຊ້ງານ.
 * ທັງສອງອັນຢືນຢັນກ່ອນສະເໝີ (useConfirm) ເພາະປ່ຽນສິດເຂົ້າໃຊ້ຂອງຄົນອື່ນ.
 */

const ROLE_OPTIONS: Option[] = ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }));

/** ສິດທີ່ກຳນົດເອງ — ລ້າງຄ່າ (x) = ກັບໄປໃຊ້ສິດຕາມຕຳແໜ່ງ */
export function RoleSelect({
  code,
  name,
  current,
  derived,
}: {
  code: string;
  name: string;
  /** null = ຍັງບໍ່ໄດ້ກຳນົດເອງ */
  current: Role | null;
  derived: Role;
}) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState<string>(current ?? "");
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  async function change(next: string) {
    const role = (next || null) as Role | null;
    if (role === (current ?? null)) return;

    const ok = await ask({
      title: role ? "ປ່ຽນສິດເຂົ້າໃຊ້?" : "ກັບໄປໃຊ້ສິດຕາມຕຳແໜ່ງ?",
      message: role ? (
        <>
          <b className="text-slate-700">{name}</b> ຈະໄດ້ສິດ <b className="text-slate-700">{ROLE_LABEL[role]}</b>{" "}
          ຄັ້ງຕໍ່ໄປທີ່ເຂົ້າລະບົບ
        </>
      ) : (
        <>
          ລົບສິດທີ່ກຳນົດເອງຂອງ <b className="text-slate-700">{name}</b> ອອກ — ຈະກັບໄປໃຊ້ສິດຕາມຕຳແໜ່ງ (
          <b className="text-slate-700">{ROLE_LABEL[derived]}</b>)
        </>
      ),
      confirmLabel: role ? "ບັນທຶກ" : "ລົບສິດທີ່ກຳນົດເອງ",
      tone: role ? "default" : "warning",
    });
    if (!ok) return;

    setValue(next);
    setError("");
    start(async () => {
      const result = await setEmployeeRole(code, role);
      if (result.error) {
        setError(result.error);
        setValue(current ?? "");
      }
    });
  }

  return (
    <>
      {dialog}
      <div className="min-w-40">
        <SelectField
          name={`role_${code}`}
          options={ROLE_OPTIONS}
          value={value}
          onChange={(next) => void change(next)}
          placeholder="ຕາມຕຳແໜ່ງ"
          isDisabled={pending}
        />
        {pending && (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
            <LoaderCircle className="size-3 animate-spin" />
            ກຳລັງບັນທຶກ
          </span>
        )}
        {error && <span className="mt-0.5 block text-[10px] font-semibold text-red-600">{error}</span>}
      </div>
    </>
  );
}

/** ໃຊ້ງານໄດ້ / ຖືກປິດ — ປິດແລ້ວ ຄົນນັ້ນເຂົ້າລະບົບບໍ່ໄດ້ ແລະ ບໍ່ໄດ້ຮັບການແຈ້ງເຕືອນ */
export function ActiveToggle({ code, name, active }: { code: string; name: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const { ask, dialog } = useConfirm();

  async function toggle() {
    const next = !active;
    const ok = await ask({
      title: next ? "ເປີດການໃຊ້ງານຄືນ?" : "ປິດການໃຊ້ງານ?",
      message: next ? (
        <>
          <b className="text-slate-700">{name}</b> ຈະເຂົ້າລະບົບໄດ້ຄືນ
        </>
      ) : (
        <>
          <b className="text-slate-700">{name}</b> ຈະ <b className="text-slate-700">ເຂົ້າລະບົບບໍ່ໄດ້</b> ແລະ
          ບໍ່ໄດ້ຮັບການແຈ້ງເຕືອນອີກ
        </>
      ),
      confirmLabel: next ? "ເປີດການໃຊ້ງານ" : "ປິດການໃຊ້ງານ",
      tone: next ? "default" : "danger",
    });
    if (!ok) return;

    setError("");
    start(async () => {
      const result = await setEmployeeActive(code, next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      {dialog}
      <button
        type="button"
        disabled={pending}
        onClick={() => void toggle()}
        title={active ? "ກົດເພື່ອປິດການໃຊ້ງານ" : "ກົດເພື່ອເປີດການໃຊ້ງານ"}
        className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition disabled:opacity-50 ${
          active
            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "bg-red-50 text-red-700 hover:bg-red-100"
        }`}
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : active ? (
          <CircleCheck className="size-3.5" />
        ) : (
          <Ban className="size-3.5" />
        )}
        {active ? "ໃຊ້ງານໄດ້" : "ຖືກປິດ"}
      </button>
      {error && <span className="mt-0.5 block text-[10px] font-semibold text-red-600">{error}</span>}
    </>
  );
}
