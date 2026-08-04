import { getSession } from "@/lib/auth";
import { readUpload } from "@/lib/uploads";
import { basename, extname } from "node:path";
import { NextResponse } from "next/server";

/**
 * ຮູບຂອງ ods ຢູ່ໃນ static/uploads ຂອງ Flask — ຕັ້ງ path ດ້ວຍ ODS_UPLOADS_DIR.
 * ອ່ານຜ່ານ readUpload() ຂອງ lib/uploads ເທົ່ານັ້ນ ⇒ ອ່ານບ່ອນດຽວກັບທີ່ຂຽນສະເໝີ.
 */

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  // ວິດີໂອ — ໃບຮັບເຄື່ອງແນບໄດ້ (ເກັບຮ່ວມ product_image, ແຍກດ້ວຍນາມສະກຸນ)
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".3gp": "video/3gpp",
};

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await getSession())) return new NextResponse(null, { status: 401 });

  // basename() ຕັດ path traversal (../) ອອກ — ຮັບໄດ້ແຕ່ຊື່ໄຟລ໌ລ້ວນໆ
  const file = basename(decodeURIComponent((await params).file));
  const type = contentTypes[extname(file).toLowerCase()];
  if (!type) return new NextResponse(null, { status: 404 });

  const body = await readUpload(file);
  if (!body) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(body), {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" },
  });
}
