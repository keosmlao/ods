import { getSession } from "@/lib/auth";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { NextResponse } from "next/server";

/** ຮູບຂອງ ods ຢູ່ໃນ static/uploads ຂອງ Flask — ຕັ້ງ path ດ້ວຍ ODS_UPLOADS_DIR */
const uploadsDir = process.env.ODS_UPLOADS_DIR;

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await getSession())) return new NextResponse(null, { status: 401 });
  if (!uploadsDir) return new NextResponse(null, { status: 404 });

  // basename() ຕັດ path traversal (../) ອອກ — ຮັບໄດ້ແຕ່ຊື່ໄຟລ໌ລ້ວນໆ
  const file = basename(decodeURIComponent((await params).file));
  const type = contentTypes[extname(file).toLowerCase()];
  if (!type) return new NextResponse(null, { status: 404 });

  try {
    const body = await readFile(join(uploadsDir, file));
    return new NextResponse(new Uint8Array(body), {
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
