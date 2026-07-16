"use client";
import { Camera, ImagePlus, Video, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Media = { id: string; file: File; url: string; kind: "image" | "video" };

/**
 * ຮູບ/ວິດີໂອສິນຄ້າ — ບໍ່ຈຳກັດຈຳນວນ (ods ຈຳກັດ 4 ຮູບ ແຕ່ຕາຕະລາງ product_image ບໍ່ຈຳກັດ).
 * ລາກໄຟລ໌ມາວາງ, ເລືອກຫຼາຍໄຟລ໌, ຖ່າຍຮູບ ຫຼື ຖ່າຍວິດີໂອຈາກກ້ອງ (ມືຖື/ແທັບເລັດ).
 *
 * ໄຟລ໌ຖືກສົ່ງໄປ server ຜ່ານ DataTransfer ໃສ່ input[type=file][multiple] ຊື່ "photos"
 * (ຊື່ເກົ່າ — collectUploads ອ່ານ field ນີ້; ຮັບທັງຮູບ ແລະ ວິດີໂອ). ວິດີໂອ ≤ 100MB/ອັນ,
 * body ລວມທັງ submit ຈຳກັດຢູ່ next.config (serverActions.bodySizeLimit).
 */
export function ServicePhotos() {
  const [media, setMedia] = useState<Media[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  // input[name=photos] ຄືຕົວທີ່ຖືກ submit ຈິງ — sync ໃຫ້ຕົງກັບ state ສະເໝີ
  useEffect(() => {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    for (const item of media) transfer.items.add(item.file);
    inputRef.current.files = transfer.files;
  }, [media]);

  useEffect(() => () => { for (const item of media) URL.revokeObjectURL(item.url); }, [media]);

  function add(files: FileList | null) {
    if (!files?.length) return;
    const accepted = [...files]
      .map((file) => ({
        file,
        kind: file.type.startsWith("video/") ? ("video" as const) : file.type.startsWith("image/") ? ("image" as const) : null,
      }))
      .filter((entry): entry is { file: File; kind: "image" | "video" } => entry.kind !== null);
    setMedia((old) => [
      ...old,
      ...accepted.map(({ file, kind }) => ({
        id: `${file.name}-${file.size}-${Math.random()}`,
        file,
        kind,
        url: URL.createObjectURL(file),
      })),
    ]);
  }

  function remove(id: string) {
    setMedia((old) => {
      const gone = old.find((item) => item.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return old.filter((item) => item.id !== id);
    });
  }

  return (
    <div className="space-y-3">
      {/* ຕົວທີ່ຖືກ submit ຈິງ — ຮັບທັງຮູບ ແລະ ວິດີໂອ */}
      <input ref={inputRef} type="file" name="photos" multiple accept="image/*,video/*" className="hidden" />
      <input ref={pickRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition ${
          dragging ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <ImagePlus className="mx-auto size-7 text-slate-400" />
        <p className="mt-2 text-sm text-slate-600">ລາກຮູບ ຫຼື ວິດີໂອ ມາວາງທີ່ນີ້</p>
        <p className="text-xs text-slate-400">ໃສ່ໄດ້ບໍ່ຈຳກັດຈຳນວນ · ວິດີໂອສູງສຸດ 100MB/ອັນ</p>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => pickRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ImagePlus className="size-4" />
            ເລືອກຮູບ/ວິດີໂອ
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Camera className="size-4" />
            ຖ່າຍຮູບ
          </button>
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Video className="size-4" />
            ຖ່າຍວິດີໂອ
          </button>
        </div>
      </div>

      {media.length > 0 && (
        <>
          <p className="text-xs font-medium text-slate-500">{media.length} ໄຟລ໌ · ອັນທຳອິດຈະເປັນໜ້າປົກ</p>
          <div className="grid grid-cols-3 gap-2">
            {media.map((item, index) => (
              <div key={item.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-900/5">
                {item.kind === "video" ? (
                  <video src={item.url} muted playsInline className="size-full object-cover" />
                ) : (
                  <Image src={item.url} alt="" fill unoptimized sizes="120px" className="object-cover" />
                )}
                {item.kind === "video" && (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center">
                    <Video className="size-6 text-white drop-shadow" />
                  </span>
                )}
                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-teal-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    ໜ້າປົກ
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label="ເອົາອອກ"
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-red-600 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
