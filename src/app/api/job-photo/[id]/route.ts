import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { photoResponse } from "@/lib/photo-response";
import { NextResponse } from "next/server";

/**
 * ຮູບຜົນງານ 1 ຮູບ (ods_job_photo — ກວດເຊັກ/ສ້ອມສຳເລັດ) ຕາມ id.
 * ໃຊ້ເປັນ **ລິ້ງເປີດຮູບເຕັມ**: ໃສ່ data-URI ໃສ່ href ບໍ່ໄດ້ (Chrome ຫ້າມ — ໄດ້ແທັບເປົ່າ).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new NextResponse("unauthorized", { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new NextResponse("not found", { status: 404 });

  const row = (await query<{ photo: string | null }>("select photo from ods_job_photo where id=$1", [id])).rows[0];
  return photoResponse(row?.photo);
}
