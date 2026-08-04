import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { photoResponse } from "@/lib/photo-response";
import { NextResponse } from "next/server";

/**
 * ຮູບ check-in ໜ້າງານ ຂອງໃບ — ສົ່ງເປັນຮູບຈິງ (ບໍ່ແມ່ນ base64 ໃນ HTML)
 * ⇒ ໜ້າ list ໃສ່ <img src> ໄດ້ ໂດຍ HTML ບໍ່ໜັກ ແລະ ໂຫຼດຮູບແບບ lazy.
 *
 * ບໍ່ໃສ່ ?id= → ຮູບ check-in **ທຳອິດ** ຂອງງານສ້ອມ (ພຶດຕິກຳເກົ່າ ໜ້າ list ໃຊ້ຢູ່)
 * ໃສ່ ?id=   → ຮູບຂອງ check-in ແຖວນັ້ນ (ໜ້າລາຍລະອຽດມີຫຼາຍຄັ້ງ ⇒ ຕ້ອງລະບຸແຖວ)
 */
export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  const { code } = await context.params;
  const idParam = new URL(request.url).searchParams.get("id");
  const id = idParam === null ? null : Number(idParam);
  if (id !== null && !Number.isInteger(id)) return new NextResponse("not found", { status: 404 });

  const row = (
    id === null
      ? await query<{ photo: string | null }>(
          `select checkin_photo as photo from ods_job_checkin
            where workflow='repair' and job_code=$1 and checkin_photo is not null
            order by id limit 1`,
          [code],
        )
      : // ຜູກ job_code ນຳ — ຢ່າໃຫ້ເດົາ id ແລ້ວດຶງຮູບຂອງງານອື່ນ
        await query<{ photo: string | null }>(
          `select checkin_photo as photo from ods_job_checkin where id=$1 and job_code=$2`,
          [id, code],
        )
  ).rows[0];

  return photoResponse(row?.photo);
}
