"use client";
import { setSetting, type SettingState } from "@/app/actions/settings";
import { useConfirm } from "@/components/confirm-dialog";
import { ErrorBox } from "@/components/ui";
import { LoaderCircle } from "lucide-react";
import { useActionState, useRef } from "react";

/**
 * ສະວິດເປີດ/ປິດ ການຕັ້ງຄ່າລະບົບ 1 ອັນ.
 * ຖາມຢືນຢັນກ່ອນສະເໝີ — ອັນນີ້ປ່ຽນພຶດຕິກຳຂອງ**ທຸກຄົນ** ບໍ່ແມ່ນຂອງຜູ້ກົດຄົນດຽວ.
 */
export function SettingSwitch({
  settingKey,
  label,
  enabled,
}: {
  settingKey: string;
  label: string;
  enabled: boolean;
}) {
  const [state, action, saving] = useActionState<SettingState, FormData>(setSetting, {});
  const formRef = useRef<HTMLFormElement>(null);
  const { ask, dialog } = useConfirm();
  const next = enabled ? "off" : "on";

  return (
    <div className="shrink-0">
      {dialog}
      {state.error && (
        <div className="mb-2">
          <ErrorBox>{state.error}</ErrorBox>
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={saving}
        onClick={async () => {
          const ok = await ask({
            title: enabled ? `ປິດ “${label}”?` : `ເປີດ “${label}”?`,
            message: enabled
              ? "ຄວາມສາມາດນີ້ຈະຫາຍໄປຈາກທຸກໜ້າ ສຳລັບທຸກຄົນ ທັນທີ"
              : "ຄວາມສາມາດນີ້ຈະປາກົດຢູ່ທຸກໜ້າ ສຳລັບຜູ້ທີ່ມີສິດ ທັນທີ",
            confirmLabel: enabled ? "ປິດ" : "ເປີດ",
            tone: enabled ? "danger" : undefined,
          });
          if (ok) formRef.current?.requestSubmit();
        }}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${
          enabled ? "bg-teal-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`grid size-5 place-items-center rounded-full bg-white shadow transition ${
            enabled ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        >
          {saving && <LoaderCircle className="size-3 animate-spin text-slate-500" />}
        </span>
      </button>

      <form ref={formRef} action={action} className="hidden">
        <input type="hidden" name="key" value={settingKey} />
        <input type="hidden" name="enabled" value={next} />
      </form>
    </div>
  );
}
