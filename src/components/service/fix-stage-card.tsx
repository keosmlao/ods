"use client";
import { fixJobStage, type StageFixState } from "@/app/actions/stage-fix";
import { STAGE_LABEL } from "@/lib/stage";
import { FIXABLE_STAGES } from "@/lib/stage-fix";
import { AlertTriangle, LoaderCircle, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * **ແກ້ຂັ້ນຂອງໃບງານໃຫ້ຕົງກັບຄວາມຈິງ** — ສະແດງສະເພາະຜູ້ຈັດການ.
 *
 * ພັບໄວ້ເປັນຄ່າຕັ້ງຕົ້ນ ແລະ ໃຊ້ສີເຕືອນ — ອັນນີ້ບໍ່ແມ່ນປຸ່ມທີ່ຄວນກົດປະຈຳວັນ
 * ແຕ່ເປັນເຄື່ອງມືແກ້ຂໍ້ມູນທີ່ຜິດ. ດ່ານຈິງ (ສິດ · ໃບຮັບເງິນ · ຄິວຍົກເລີກ) ຢູ່ server.
 */
export function FixStageCard({ code, currentStage }: { code: string; currentStage: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<StageFixState>({});
  const [pending, start] = useTransition();

  const submit = () => {
    if (stage === null) return;
    start(async () => {
      const result = await fixJobStage(code, stage, reason);
      setState(result);
      if (result.ok) {
        setReason("");
        setStage(null);
        router.refresh();
      }
    });
  };

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
          <Wrench className="size-4" />
          ແກ້ຂັ້ນໃບງານໃຫ້ຕົງກັບຄວາມຈິງ
        </p>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
        >
          {open ? "ປິດ" : "ເປີດ"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-amber-700">
        ຂັ້ນປັດຈຸບັນ: <b>{STAGE_LABEL[currentStage] ?? currentStage}</b> · ໃຊ້ເມື່ອໃບຄ້າງຢູ່ຂັ້ນຜິດ (ລືມກົດ / ຂໍ້ມູນເກົ່າ)
      </p>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FIXABLE_STAGES.map((value) => (
              <button
                key={value}
                type="button"
                disabled={value === currentStage}
                onClick={() => setStage(value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                  stage === value
                    ? "bg-amber-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {STAGE_LABEL[value]}
              </button>
            ))}
          </div>

          {/*
            ຂັ້ນ 3-7 ບໍ່ມີໃນລາຍການ — ມັນຄິດຈາກ **ເອກະສານຈິງ** (ໃບສະເໜີລາຄາ · ໃບຂໍເບີກ ·
            ໃບສັ່ງຊື້) ບໍ່ແມ່ນຈາກທຸງຂອງໃບງານ ⇒ ບັງຄັບໄປໂດຍບໍ່ມີເອກະສານ ຕົວເລກຈະຂັດກັນ.
          */}
          <p className="text-[11px] text-slate-500">
            ຂັ້ນ ສະເໜີລາຄາ / ກວດ Stock / ເບີກ / ສັ່ງຊື້ ຕັ້ງຢູ່ນີ້ບໍ່ໄດ້ — ມັນຄິດຈາກເອກະສານຈິງ
            (ໃບສະເໜີລາຄາ · ໃບຂໍເບີກ · ໃບສັ່ງຊື້) ⇒ ຕ້ອງອອກ ຫຼື ຍົກເລີກເອກະສານນັ້ນຕາມຈິງ.
            ງານນອກສະຖານທີ່ (IH/PS) ທີ່ຍັງບໍ່ມີວັນນັດ/ຍັງບໍ່ໄປຮັບ ຈະຕົກເປັນ “ລໍໄປຮັບ/ລໍນັດໝາຍ”
            ແທນ “ລໍຖ້າກວດເຊັກ” — ອັນນັ້ນຖືກຕ້ອງແລ້ວ
          </p>

          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="ເຫດຜົນ * (ເຊັ່ນ ຊ່າງສ້ອມຈົບແລ້ວແຕ່ລືມກົດ)"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-amber-500"
          />

          <button
            type="button"
            disabled={pending || stage === null || !reason.trim()}
            onClick={submit}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Wrench className="size-4" />}
            ບັນທຶກການແກ້ຂັ້ນ
          </button>

          {state.error && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <AlertTriangle className="size-3.5" />
              {state.error}
            </p>
          )}
          {state.ok && <p className="text-xs font-semibold text-emerald-700">{state.ok}</p>}
        </div>
      )}
    </section>
  );
}
