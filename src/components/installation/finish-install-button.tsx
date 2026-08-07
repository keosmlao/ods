"use client";
import { finishInstall } from "@/app/actions/installation";
import { Button } from "@/components/ui";
import { Camera, Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * "ຕິດຕັ້ງສຳເລັດ" — **ຕ້ອງແນບຮູບຜົນງານຢ່າງໜ້ອຍ 1 ຮູບ**.
 *
 * ຮູບ check-in ຄືສະພາບ "ກ່ອນເຮັດ" · ຮູບ QC ຖ່າຍໂດຍຄົນອື່ນໃນມື້ຕໍ່ມາ
 * ⇒ ບໍ່ມີຫຼັກຖານວ່າຕອນຊ່າງອອກຈາກໜ້າງານ ວຽກຢູ່ໃນສະພາບໃດ (ເບິ່ງ lib/job-flow).
 *
 * ⚠️ ຮູບເກັບເປັນ base64 ໃນຖານ ⇒ **ບີບຢູ່ນີ້ກ່ອນສົ່ງ** (ກວ້າງ ≤1200px, JPEG 0.7)
 * ບໍ່ດັ່ງນັ້ນຕາຕະລາງຈະບວມເປັນ GB. ດ່ານສຸດທ້າຍຢູ່ຝັ່ງ server.
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

export function FinishInstallButton({ code }: { code: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  /** ງານບໍ່ມີ check-in ⇒ server ຂໍເຫດຜົນ "ບັນທຶກແທນຊ່າງ" (ເບິ່ງ lib/job-flow.onBehalfGate) */
  const [needReason, setNeedReason] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const shots = await Promise.all([...files].map(compress));
      setPhotos((current) => [...current, ...shots]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button tone="success" className="h-8 px-3 text-xs" onClick={() => setOpen(true)}>
        ຕິດຕັ້ງສຳເລັດ
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          ຖ່າຍ/ເລືອກຮູບຜົນງານ
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(event) => pick(event.target.files)}
          />
        </label>
        <span className="text-xs text-slate-500">{photos.length} ຮູບ</span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPhotos([]);
            setError("");
          }}
          className="grid size-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {photos.map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={index} src={photo} alt="" className="h-14 w-14 rounded border border-slate-200 object-cover" />
          ))}
        </div>
      )}

      {error && <span className="text-[11px] font-semibold text-brand-orange-700">{error}</span>}

      {/*
        ── ບັນທຶກແທນຊ່າງ (07-08-2026) ──
        ງານໜ້າງານທີ່ **ບໍ່ມີ check-in ຈັກແຖວ** ⇒ server ຂໍເຫດຜົນກ່ອນ (lib/job-flow.onBehalfGate)
        ⇒ ພໍໄດ້ຮັບ error ນັ້ນ ຈຶ່ງໂຊ້ວຊ່ອງນີ້ ແລ້ວກົດຊ້ຳໄດ້ເລີຍ. ບໍ່ຫ້າມ ແຕ່ຕ້ອງມີຫຼັກຖານວ່າໃຜກົດແທນ ແລະ ຍ້ອນຫຍັງ.
      */}
      {needReason && (
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="ເຫດຜົນທີ່ບັນທຶກແທນຊ່າງ (ມືຖືຊ່າງເສຍ · ບັນທຶກຍ້ອນຫຼັງ …)"
          className="w-full rounded-lg border border-brand-orange-300 px-3 py-2 text-xs outline-none focus:border-brand-orange-500"
        />
      )}

      <Button
        tone="success"
        className="h-8 px-3 text-xs"
        disabled={photos.length === 0 || pending || busy}
        onClick={() =>
          start(async () => {
            const result = await finishInstall(code, photos, reason);
            if (result.error) {
              setError(result.error);
              // server ບອກວ່າຂາດເຫດຜົນ ⇒ ເປີດຊ່ອງໃຫ້ພິມ
              if (result.error.includes("check-in")) setNeedReason(true);
              return;
            }
            setOpen(false);
            router.refresh();
          })
        }
      >
        {pending && <LoaderCircle className="size-3.5 animate-spin" />}
        <Check className="size-3.5" />
        ຢືນຢັນ ຕິດຕັ້ງສຳເລັດ
      </Button>
    </div>
  );
}
