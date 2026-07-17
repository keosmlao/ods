import { SettingSwitch } from "@/components/settings/setting-switch";
import { requireRoleOrRedirect } from "@/lib/guard";
import { allSettings, SETTING_META } from "@/lib/settings";
import { Settings2 } from "lucide-react";

/**
 * **ການຕັ້ງຄ່າລະບົບ** — ສະວິດເປີດ/ປິດຄວາມສາມາດ ທີ່**ຜູ້ຈັດການ**ແກ້ເອງໄດ້
 * ໂດຍບໍ່ຕ້ອງແກ້ໂຄ້ດ + deploy.
 *
 * ນິຍາມຢູ່ `src/lib/settings.ts` ບ່ອນດຽວ (key · ຄຳອະທິບາຍ · ຄ່າຕັ້ງຕົ້ນ) ⇒ ເພີ່ມການ
 * ຕັ້ງຄ່າໃໝ່ ພຽງເພີ່ມໃນ SETTING/SETTING_META ແລ້ວໜ້ານີ້ຂຶ້ນເອງ.
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireRoleOrRedirect(["manager"]);
  const settings = await allSettings();

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-700">
          <Settings2 className="size-5" />
          ການຕັ້ງຄ່າລະບົບ
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          ເປີດ/ປິດ ຄວາມສາມາດຂອງລະບົບ — ມີຜົນກັບ<b>ທຸກຄົນ</b>ທັນທີ
        </p>
      </div>

      <section className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {settings.map(({ key, enabled, configured, updated_by, updated_at }) => {
          const meta = SETTING_META[key];
          return (
            <div key={key} className="flex items-start justify-between gap-6 p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-700">{meta.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{meta.help}</p>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  {configured
                    ? `ແກ້ລ່າສຸດໂດຍ ${updated_by ?? "-"} · ${updated_at ?? "-"}`
                    : `ຍັງບໍ່ເຄີຍຕັ້ງ — ໃຊ້ຄ່າຕັ້ງຕົ້ນ (${meta.fallback ? "ເປີດ" : "ປິດ"})`}
                </p>
              </div>
              <SettingSwitch settingKey={key} label={meta.label} enabled={enabled} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
