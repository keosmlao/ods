import { getSession } from "@/lib/auth";
import { deliveryPhotos } from "@/lib/delivery";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ຮູບຕອນຂົນສົ່ງໄປສົ່ງເຄື່ອງ — ດຶງຕອນຄົນກົດເບິ່ງເທົ່ານັ້ນ (ຮູບເປັນ base64 ຫຼາຍ 100KB).
 *
 * ⚠️ matcher ຂອງ src/proxy.ts ຕັດ /api ອອກ ⇒ ຕ້ອງກວດ session ເອງຢູ່ນີ້.
 * ບໍ່ຈຳກັດ role: ຄົນທີ່ເປີດໜ້າງານຕິດຕັ້ງໄດ້ (ລວມ**ຊ່າງ**) ຕ້ອງເຫັນຮູບບ່ອນສົ່ງ
 * ຄືກັບ /installations/* ທີ່ເປັນ EVERYONE — ຮູບນີ້ບໍ່ມີລາຄາ/ຂໍ້ມູນການເງິນ.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bill = (request.nextUrl.searchParams.get("bill") ?? "").trim();
  if (!bill) return NextResponse.json({ error: "ຕ້ອງລະບຸເລກບິນ" }, { status: 400 });

  try {
    return NextResponse.json({ data: await deliveryPhotos(bill) });
  } catch (error) {
    console.error("delivery photos failed", error);
    return NextResponse.json({ error: "ດຶງຮູບບໍ່ສຳເລັດ" }, { status: 500 });
  }
}
