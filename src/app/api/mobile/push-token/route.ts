import { requireMobile } from "@/lib/mobile-auth";
import { removePushToken, savePushToken } from "@/lib/push";
import { NextResponse } from "next/server";

/** ແອັບລົງທະບຽນ token ຂອງເຄື່ອງ (ຕອນເປີດແອັບ) ແລະ ຖອນຕອນ logout */
export async function POST(request: Request) {
  const guard = await requireMobile(request);
  if (!guard.ok) return guard.response;

  let body: { token?: string; platform?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  /**
   * ດຽວນີ້ເປັນ **FCM token** (ແອັບເປັນ Flutter ແລ້ວ — ຮຸ່ນເກົ່າເປັນ ExponentPushToken).
   * ຮູບແບບຂອງ FCM ບໍ່ຄົງທີ່ ⇒ ກວດພຽງຄວາມຍາວ (ຖັນເປັນ varchar(200)).
   */
  const token = String(body.token ?? "").trim();
  if (token.length < 20 || token.length > 200) {
    return NextResponse.json({ error: "token ບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  await savePushToken(guard.user.username, token, String(body.platform ?? "").slice(0, 10));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await requireMobile(request);
  if (!guard.ok) return guard.response;

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (token) await removePushToken(token);
  return NextResponse.json({ ok: true });
}
