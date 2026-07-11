"use client";
import { Camera, ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Photo = { id: string; file: File; url: string };

/**
 * ຮູບສິນຄ້າ — ບໍ່ຈຳກັດຈຳນວນ (ods ຈຳກັດ 4 ຮູບ ແຕ່ຕາຕະລາງ product_image ບໍ່ມີຂໍ້ຈຳກັດ).
 * ລາກໄຟລ໌ມາວາງ, ເລືອກຫຼາຍໄຟລ໌, ຫຼືກົດຖ່າຍຮູບຈາກກ້ອງ (ມືຖື/ແທັບເລັດ).
 *
 * ໄຟລ໌ຖືກສົ່ງໄປ server ຜ່ານ DataTransfer ໃສ່ input[type=file][multiple] ຊື່ "photos".
 */
export function ServicePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // input[name=photos] ຄືຕົວທີ່ຖືກ submit ຈິງ — sync ໃຫ້ຕົງກັບ state ສະເໝີ
  useEffect(() => {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    for (const photo of photos) transfer.items.add(photo.file);
    inputRef.current.files = transfer.files;
  }, [photos]);

  useEffect(() => () => { for (const photo of photos) URL.revokeObjectURL(photo.url); }, [photos]);

  function add(files: FileList | null) {
    if (!files?.length) return;
    const images = [...files].filter((file) => file.type.startsWith("image/"));
    setPhotos((old) => [
      ...old,
      ...images.map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, url: URL.createObjectURL(file) })),
    ]);
  }

  function remove(id: string) {
    setPhotos((old) => {
      const gone = old.find((photo) => photo.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return old.filter((photo) => photo.id !== id);
    });
  }

  return (
    <div className="space-y-3">
      {/* ຕົວທີ່ຖືກ submit ຈິງ */}
      <input ref={inputRef} type="file" name="photos" multiple accept="image/*" className="hidden" />
      <input ref={pickRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition ${
          dragging ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <ImagePlus className="mx-auto size-7 text-slate-400" />
        <p className="mt-2 text-sm text-slate-600">ລາກຮູບມາວາງທີ່ນີ້</p>
        <p className="text-xs text-slate-400">ໃສ່ໄດ້ບໍ່ຈຳກັດຈຳນວນ</p>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => pickRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ImagePlus className="size-4" />
            ເລືອກຮູບ
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Camera className="size-4" />
            ຖ່າຍຮູບ
          </button>
        </div>
      </div>

      {photos.length > 0 && (
        <>
          <p className="text-xs font-medium text-slate-500">{photos.length} ຮູບ · ຮູບທຳອິດຈະເປັນຮູບໜ້າປົກ</p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
                <Image src={photo.url} alt="" fill unoptimized sizes="120px" className="object-cover" />
                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-teal-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    ໜ້າປົກ
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(photo.id)}
                  aria-label="ເອົາຮູບອອກ"
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
