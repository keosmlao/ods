"use client";

import { saveRepair } from "@/app/actions/repair";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { Camera, CheckCircle2, LoaderCircle, X } from "lucide-react";
import { useState, useTransition } from "react";

/**
 * ປິດວຽກສ້ອມຈາກໜ້າລາຍການ — ແທນໜ້າ /repair/[code] ທີ່ຖືກລົບ.
 *
 * ເກັບ**ຄືກັນກັບແອັບມືຖື**: ວິທີແກ້ໄຂ + ຮູບຜົນງານ ແລ້ວຜ່ານ finishRepairFlow ອັນດຽວກັນ.
 * ງານນອກສະຖານທີ່ (IH · PS ທີ່ຍັງບໍ່ໄປຮັບເຄື່ອງ) **ຕ້ອງມີຮູບຢ່າງໜ້ອຍ 1 ຮູບ** —
 * ແຕ່ກ່ອນເວັບບໍ່ມີບ່ອນແນບຮູບ ⇒ ຊ່າງປິດງານນອກສະຖານທີ່ຈາກເວັບບໍ່ໄດ້ເລີຍ (server ປະຕິເສດ).
 *
 * ⚠️ ຮູບເກັບເປັນ base64 ໃນຖານ ⇒ **ບີບຢູ່ນີ້ກ່ອນສົ່ງ** (ກວ້າງ ≤1200px, JPEG 0.7)
 * ຄືກັບ components/installation/finish-install-button.
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

export function CompleteRepairButton({ code, initialNote = "" }: { code: string; initialNote?: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(initialNote);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** ງານ IH ບໍ່ມີ check-in ⇒ server ຂໍເຫດຜົນ (ເບິ່ງ lib/job-flow.onBehalfGate) */
  const [needReason, setNeedReason] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const shots = await Promise.all([...files].map(compress));
      setPhotos((current) => [...current, ...shots]);
    } catch {
      setError("ອ່ານຮູບບໍ່ໄດ້ — ລອງເລືອກຮູບອື່ນ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        tone="success"
        size="sm"
        disabled={pending}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
        ສ້ອມສຳເລັດ
      </Button>

      <ConfirmDialog
        open={open}
        title={`ບັນທຶກສ້ອມແປງສຳເລັດ #${code}`}
        confirmLabel="ຢືນຢັນສຳເລັດ"
        pending={pending || busy}
        message={
          <div className="space-y-3">
            <p>ວຽກຈະຖືກສົ່ງໄປຄິວລໍກວດ QC.</p>

            <label className="block text-left">
              <span className="mb-1 block font-medium text-slate-600">ວິທີແກ້ໄຂ / ໝາຍເຫດຊ່າງ</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="ລະບຸວິທີແກ້ໄຂ..."
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 outline-none focus:border-brand-600"
              />
            </label>

            <div className="text-left">
              <span className="mb-1 block font-medium text-slate-600">
                ຮູບຜົນງານ <span className="font-normal text-slate-400">· ງານນອກສະຖານທີ່ຕ້ອງມີຢ່າງໜ້ອຍ 1 ຮູບ</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                  {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                  ຖ່າຍ/ເລືອກຮູບ
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(event) => void pick(event.target.files)}
                  />
                </label>
                <span className="text-xs text-slate-500">{photos.length} ຮູບ</span>
              </div>

              {photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {photos.map((photo, index) => (
                    <span key={index} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt="" className="size-14 rounded border border-slate-200 object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                        className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-brand-orange-700"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/*
              ງານ IH ທີ່ບໍ່ມີ check-in ⇒ server ຂໍເຫດຜົນ "ບັນທຶກແທນຊ່າງ" ກ່ອນ
              (lib/job-flow.onBehalfGate) ⇒ ເປີດຊ່ອງໃຫ້ພິມແລ້ວກົດຢືນຢັນຄືນໄດ້ເລີຍ.
            */}
            {needReason && (
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="ເຫດຜົນທີ່ບັນທຶກແທນຊ່າງ (ມືຖືຊ່າງເສຍ · ບັນທຶກຍ້ອນຫຼັງ …)"
                className="w-full rounded-lg border border-brand-orange-300 px-3 py-2 text-xs outline-none focus:border-brand-orange-500"
              />
            )}

            {error && <p className="font-medium text-brand-orange-700">{error}</p>}
          </div>
        }
        onCancel={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={() =>
          start(async () => {
            const data = new FormData();
            data.set("pro_code", code);
            data.set("repair_note", note);
            data.set("photos", JSON.stringify(photos));
            if (reason.trim()) data.set("on_behalf_reason", reason.trim());
            const result = await saveRepair({}, data);
            if (result?.error) {
              setError(result.error);
              if (result.error.includes("check-in")) setNeedReason(true);
            }
          })
        }
      />
    </>
  );
}
