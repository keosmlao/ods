import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * ຮູບ check-in ໜ້າງານ (ຮູບທຳອິດ) ຂອງໃບ — ສົ່ງເປັນຮູບຈິງ (ບໍ່ແມ່ນ base64 ໃນ HTML)
 * ⇒ ໜ້າ list ໃສ່ <img src> ໄດ້ ໂດຍ HTML ບໍ່ໜັກ ແລະ ໂຫຼດຮູບແບບ lazy.
 */
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  const { code } = await context.params;
  const row = (
    await query<{ photo: string | null }>(
      `select checkin_photo as photo from ods_job_checkin
        where workflow='repair' and job_code=$1 and checkin_photo is not null
        order by id limit 1`,
      [code],
    )
  ).rows[0];
  if (!row?.photo) return new NextResponse("not found", { status: 404 });

  // data-URI → bytes
  const match = row.photo.match(/^data:(image\/[\w.+-]+);base64,([\s\S]*)$/);
  const mime = match?.[1] ?? "image/jpeg";
  const base64 = match?.[2] ?? row.photo.replace(/^data:[^,]*,/, "");
  const bytes = Buffer.from(base64, "base64");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": mime,
      "cache-control": "private, max-age=300",
    },
  });
}
