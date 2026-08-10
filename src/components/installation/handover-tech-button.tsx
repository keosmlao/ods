"use client";

import { handoverInstallTech } from "@/app/actions/installation";
import { HelperPicker } from "@/components/tech-helpers";
import { LoaderCircle, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ປ່ຽນຊ່າງກາງທາງ** — ງານທີ່ໄປຫຼາຍຮອບ ຮອບຕໍ່ໄປອາດເປັນຊ່າງຄົນອື່ນ.
 *
 * ຕ່າງຈາກ “ເລືອກຊ່າງໃໝ່” ຢູ່ຄິວຈັດຊ່າງ (ອັນນັ້ນດຶງງານກັບໄປຄິວ ⇒ ໃຊ້ໄດ້ແຕ່ຕອນຍັງບໍ່ເລີ່ມ):
 * ອັນນີ້ **ບໍ່ຖອຍຂັ້ນ** — ອາໄຫຼ່ທີ່ເບີກແລ້ວ ແລະ ຮອບທີ່ໄປແລ້ວ ຄາຢູ່ຄືເກົ່າ.
 */
export function HandoverTechButton({
  code,
  current,
  techs,
  helpers = [],
}: {
  code: string;
  current: string | null;
  techs: { code: string; name: string }[];
  /** ຊ່າງຮ່ວມປັດຈຸບັນ — ແກ້ພ້ອມການສົ່ງມອບໄດ້ເລີຍ (10-08-2026) */
  helpers?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tech, setTech] = useState("");
  /**
   * ທີມຂອງຮອບຕໍ່ໄປ — ຕັ້ງຕົ້ນເປັນທີມເກົ່າ ບວກ**ຫົວໜ້າຄົນເກົ່າ** (ຄົນທີ່ໄປແລ້ວມັກຕ້ອງ
   * ໄປນຳຮອບຕໍ່ໄປ ເພື່ອສົ່ງຕໍ່ໜ້າງານ) — ຖອດອອກໄດ້ຖ້າບໍ່ຕ້ອງການ.
   */
  const [team, setTeam] = useState<string[]>(helpers);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setTech("");
          setReason("");
          setTeam(current ? [...new Set([...helpers, current])] : helpers);
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <UserRoundCog className="size-4" />
        ປ່ຽນຊ່າງ
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <h2 className="text-base font-bold text-slate-800">ສົ່ງມອບງານໃຫ້ຊ່າງຄົນໃໝ່</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {code} · ຊ່າງປັດຈຸບັນ <b>{current || "-"}</b> — ຂັ້ນງານ ແລະ ອາໄຫຼ່ທີ່ເບີກແລ້ວບໍ່ຖືກແຕະ
              </p>
            </div>

            <label className="block text-xs font-semibold text-slate-600">
              ຊ່າງຄົນໃໝ່
              <select
                value={tech}
                onChange={(event) => setTech(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-600"
              >
                <option value="">— ເລືອກຊ່າງ —</option>
                {techs
                  .filter((item) => item.code !== current)
                  .map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>

            {tech && (
              <HelperPicker
                techs={techs}
                lead={tech}
                value={team}
                onChange={setTeam}
                label="ທີມຮອບຕໍ່ໄປ (ຊ່າງຮ່ວມ — ບໍ່ໄດ້ກົດຮັບ/ຈົບງານ)"
              />
            )}

            <label className="block text-xs font-semibold text-slate-600">
              ເຫດຜົນ
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="ຕົວຢ່າງ: ຊ່າງເກົ່າລາພັກ · ຍ້າຍໄປງານດ່ວນ · ຮອບຕໍ່ໄປທີມອື່ນຮັບຊ່ວງ"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
              />
            </label>

            {error && <p className="rounded-lg bg-brand-orange-50 px-3 py-2 text-xs text-brand-orange-700">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await handoverInstallTech(code, tech, reason, team);
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    setOpen(false);
                    router.refresh();
                  })
                }
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-4 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {pending && <LoaderCircle className="size-3.5 animate-spin" />}
                ສົ່ງມອບງານ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
