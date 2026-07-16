"use client";
import { setLocaleAction } from "@/app/actions/locale";
import { LOCALE_LABEL, LOCALES, type Locale } from "@/lib/i18n/config";
import { useTransition } from "react";

/**
 * ປຸ່ມສະຫຼັບພາສາ ລາວ / ໄທ / EN.
 *
 * onChange → server action ຂຽນ cookie + revalidate ⇒ ໜ້າ render ຄືນເປັນພາສາໃໝ່
 * ໂດຍບໍ່ຕ້ອງໂຫຼດ browser ຄືນ ແລະ URL ບໍ່ປ່ຽນ. useTransition ກັນ double-click
 * ຕອນກຳລັງສະຫຼັບ ແລະ ໃຫ້ UI ຮູ້ວ່າ pending.
 */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Language">
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            disabled={pending || active}
            aria-pressed={active}
            onClick={() => startTransition(() => setLocaleAction(code))}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition disabled:cursor-default ${
              active
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800 disabled:opacity-50"
            }`}
          >
            {LOCALE_LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}
