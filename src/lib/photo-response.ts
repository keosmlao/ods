import "server-only";
import { NextResponse } from "next/server";

/**
 * ຮູບທີ່ເກັບເປັນ **data-URI base64 ໃນຖານ** (ods_job_photo · ods_job_checkin.checkin_photo)
 * → ສົ່ງອອກເປັນຮູບຈິງ.
 *
 * ⚠️ ເປັນຫຍັງຕ້ອງມີ route ໃຫ້ຮູບພວກນີ້ (ບໍ່ໃສ່ data-URI ໃສ່ href ໂດຍກົງ):
 * Chrome **ຫ້າມ** ເປີດ data: URL ເປັນໜ້າຫຼັກ (top-frame navigation, ຕັ້ງແຕ່ Chrome 60)
 * ⇒ ກົດຮູບແລ້ວໄດ້ **ແທັບເປົ່າ**. ໃສ່ໃນ <img src> ໄດ້ປົກກະຕິ ແຕ່ href ບໍ່ໄດ້.
 */
export function photoResponse(photo: string | null | undefined) {
  if (!photo) return new NextResponse("not found", { status: 404 });

  // data-URI → bytes (ບາງແຖວເກັບ base64 ລ້ວນໆ ບໍ່ມີຫົວ data: — ຖືເປັນ jpeg)
  const match = photo.match(/^data:(image\/[\w.+-]+);base64,([\s\S]*)$/);
  const mime = match?.[1] ?? "image/jpeg";
  const base64 = match?.[2] ?? photo.replace(/^data:[^,]*,/, "");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return new NextResponse("not found", { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: { "content-type": mime, "cache-control": "private, max-age=300" },
  });
}
