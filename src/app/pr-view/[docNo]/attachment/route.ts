import { query } from "@/lib/db";
import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { NextResponse } from "next/server";

/**
 * ຮູບເອກະສານເເນບຂອງໃບສະເໜີຊື້ — ເປີດສາທາລະນະຄືກັບໜ້າ /pr-view (ບໍ່ຕ້ອງ login).
 *
 * ຈຳກັດຂອບເຂດແໜ້ນ: ສົ່ງໄດ້ແຕ່ໄຟລ໌ທີ່ຜູກກັບ doc_no ນັ້ນຈິງໆ (product_image.iteme_code = doc_ref
 * ຂອງເອກະສານ) — ຊື່ໄຟລ໌ມາຈາກຖານຂໍ້ມູນ ບໍ່ແມ່ນຈາກ URL → ຂໍໄຟລ໌ອື່ນໃນ uploads ບໍ່ໄດ້.
 * (/api/uploads ຕ້ອງ login ຈຶ່ງໃຊ້ບໍ່ໄດ້ຢູ່ໜ້ານີ້)
 */

const uploadsDir = process.env.ODS_UPLOADS_DIR;

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(_: Request, { params }: { params: Promise<{ docNo: string }> }) {
  if (!uploadsDir) return new NextResponse(null, { status: 404 });

  const docNo = decodeURIComponent((await params).docNo);
  const result = await query<{ product_url: string | null }>(
    `select (select product_url from product_image where iteme_code = a.doc_ref limit 1) product_url
     from ic_trans a where a.doc_no = $1`,
    [docNo],
  );
  const stored = result.rows[0]?.product_url;
  if (!stored) return new NextResponse(null, { status: 404 });

  const file = basename(stored);
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
