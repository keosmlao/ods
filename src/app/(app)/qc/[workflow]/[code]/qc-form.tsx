"use client";
import { type QcItem, saveQc } from "@/app/actions/qc";
import type { Workflow } from "@/lib/commission";
import { Button, ErrorBox, inputClass } from "@/components/ui";
import { Camera, Check, LoaderCircle, X } from "lucide-react";
import { useActionState, useState } from "react";

/**
 * ຟອມ QC — ຊ້ອນ checklist · ຮູບ · ລາຍເຊັນລູກຄ້າ.
 *
 * ⚠️ ຮູບເກັບເປັນ base64 ໃນຖານຂໍ້ມູນ (ຕາມທີ່ຜູ້ຈັດການເລືອກ). ຂອງເກົ່າ 200 KB ຕໍ່ຮູບ
 * ⇒ **ບີບຢູ່ນີ້ກ່ອນສົ່ງ** (ຫຍໍ້ໃຫ້ກວ້າງບໍ່ເກີນ 1200px, JPEG 0.7) ບໍ່ດັ່ງນັ້ນ
 * ຕາຕະລາງຈະບວມເປັນ GB ພາຍໃນປີດຽວ ແລະ ຖ່ວງ query ທັງລະບົບ.
 * ດ່ານສຸດທ້າຍຢູ່ຝັ່ງ server (MAX_PHOTO_CHARS ໃນ actions/qc.ts).
 */

const MAX_WIDTH = 1200;
const QUALITY = 0.7;

async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", QUALITY);
}

type Answer = { passed: boolean | null; note: string; photo: string };

export function QcForm({
  workflow,
  jobCode,
  items,
}: {
  workflow: Workflow;
  jobCode: string;
  items: QcItem[];
}) {
  const [state, action, pending] = useActionState(saveQc, {});
  const [answers, setAnswers] = useState<Record<number, Answer>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, { passed: item.passed, note: item.note ?? "", photo: item.photo ?? "" }]),
    ),
  );
  const [signer, setSigner] = useState("");
  const [tel, setTel] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const set = (id: number, patch: Partial<Answer>) =>
    setAnswers((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const answered = items.filter((item) => answers[item.id]?.passed != null).length;
  const failed = items.filter((item) => answers[item.id]?.passed === false).length;
  const complete = answered === items.length;
  // ຂໍ້ທີ່ບັງຄັບຮູບ ແລະ ຜ່ານ ຕ້ອງມີຮູບ
  const missingPhoto = items.filter(
    (item) => item.require_photo && answers[item.id]?.passed === true && !answers[item.id]?.photo,
  );

  async function pickPhoto(id: number, file: File | undefined) {
    if (!file) return;
    setBusy(id);
    try {
      set(id, { photo: await compress(file) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="workflow" value={workflow} />
      <input type="hidden" name="job_code" value={jobCode} />
      <input
        type="hidden"
        name="answers"
        value={JSON.stringify(
          items.map((item) => ({
            item_id: item.id,
            passed: answers[item.id]?.passed === true,
            note: answers[item.id]?.note ?? "",
            photo: answers[item.id]?.photo ?? "",
          })),
        )}
      />
      {/* ລາຍເຊັນ: ພິມຊື່ຜູ້ຮັບມອບ — ຮູບລາຍເຊັນຍັງບໍ່ຮອງຮັບການແຕ້ມ (ຮອບຕໍ່ໄປ) */}
      <input type="hidden" name="signature" value="" />

      {state.error && <ErrorBox>{state.error}</ErrorBox>}
      {state.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{state.ok}</p>
      )}

      <div className="space-y-2">
        {items.map((item) => {
          const answer = answers[item.id];
          return (
            <div
              key={item.id}
              className={`rounded-xl border p-3 ${
                answer?.passed === false
                  ? "border-red-300 bg-red-50"
                  : answer?.passed === true
                    ? "border-emerald-300 bg-emerald-50/50"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-48 flex-1 text-sm font-semibold text-slate-800">
                  {item.name}
                  {item.require_photo && <span className="ml-1 text-[11px] text-slate-400">(ຕ້ອງມີຮູບ)</span>}
                </span>

                <button
                  type="button"
                  onClick={() => set(item.id, { passed: true })}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold ${
                    answer?.passed === true
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <Check className="size-3.5" /> ຜ່ານ
                </button>
                <button
                  type="button"
                  onClick={() => set(item.id, { passed: false })}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold ${
                    answer?.passed === false ? "bg-red-600 text-white" : "border border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <X className="size-3.5" /> ບໍ່ຜ່ານ
                </button>

                <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  {busy === item.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                  {answer?.photo ? "ປ່ຽນຮູບ" : "ຖ່າຍຮູບ"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => pickPhoto(item.id, event.target.files?.[0])}
                  />
                </label>
              </div>

              {/* ບໍ່ຜ່ານ → ບັງຄັບໃຫ້ບອກເຫດຜົນ (ຊ່າງຕ້ອງຮູ້ວ່າຕ້ອງແກ້ຫຍັງ) */}
              {answer?.passed === false && (
                <input
                  value={answer.note}
                  onChange={(event) => set(item.id, { note: event.target.value })}
                  placeholder="ເຫດຜົນທີ່ບໍ່ຜ່ານ — ຊ່າງຈະເຫັນຂໍ້ຄວາມນີ້"
                  className={`${inputClass} mt-2`}
                />
              )}

              {answer?.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={answer.photo}
                  alt=""
                  className="mt-2 h-28 w-auto rounded-lg border border-slate-200 object-cover"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ຮັບມອບງານ — ບັນທຶກກໍ່ຕໍ່ເມື່ອ QC ຜ່ານ */}
      {failed === 0 && complete && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-bold text-slate-700">ຜູ້ຮັບມອບງານ (ລູກຄ້າ)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              name="signer_name"
              value={signer}
              onChange={(event) => setSigner(event.target.value)}
              placeholder="ຊື່ຜູ້ຮັບມອບ"
              className={inputClass}
            />
            <input
              name="signer_tel"
              value={tel}
              onChange={(event) => setTel(event.target.value)}
              placeholder="ເບີໂທ (ບໍ່ບັງຄັບ)"
              className={inputClass}
            />
          </div>
        </div>
      )}
      {!(failed === 0 && complete) && (
        <>
          <input type="hidden" name="signer_name" value="" />
          <input type="hidden" name="signer_tel" value="" />
        </>
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="text-xs text-slate-500">
          ກວດແລ້ວ <b className="text-slate-800">{answered}/{items.length}</b>
          {failed > 0 && <b className="ml-2 text-red-600">ບໍ່ຜ່ານ {failed}</b>}
        </span>
        {missingPhoto.length > 0 && (
          <span className="text-xs font-semibold text-amber-700">
            ຕ້ອງແນບຮູບ: {missingPhoto.map((item) => item.name).join(", ")}
          </span>
        )}
        <Button
          tone={failed > 0 ? "danger" : "success"}
          disabled={pending || !complete || missingPhoto.length > 0}
          className="ml-auto h-9 px-4 text-xs"
        >
          {pending && <LoaderCircle className="size-3.5 animate-spin" />}
          {failed > 0 ? `ບໍ່ຜ່ານ — ສົ່ງກັບໃຫ້ຊ່າງ (${failed})` : "QC ຜ່ານ — ໄປຂັ້ນຕໍ່ໄປ"}
        </Button>
      </div>
    </form>
  );
}
