import type { Session } from "@/lib/auth";
import { type Role, roleOf } from "@/lib/roles";
import { jwtVerify, SignJWT } from "jose";
import { NextResponse } from "next/server";

/**
 * ດ່ານກວດຕົວຕົນຂອງ **ແອັບມືຖື** — Bearer token, ບໍ່ແມ່ນ cookie.
 *
 * ── ເປັນຫຍັງບໍ່ໃຊ້ cookie ຄືເວັບ ──
 * ແອັບ native ບໍ່ມີ cookie jar ຂອງ browser ແລະ SameSite ຂອງເວັບຈະກັນຄຳຂໍຈາກແອັບ.
 * ⇒ ອອກ token ໃຫ້ຕອນ login ແລ້ວແອັບເກັບໄວ້ (SecureStore) ສົ່ງມາທຸກຄັ້ງໃນ header.
 *
 * ── ຄວາມແຕກຕ່າງທີ່ຕັ້ງໃຈ ──
 * ອາຍຸ 30 ມື້ (ເວັບ 12 ຊົ່ວໂມງ): ຊ່າງຢູ່ໜ້າງານ ບໍ່ຄວນຖືກໄລ່ອອກກາງເຄິ່ງງານ.
 * ໃສ່ `aud: "mobile"` ⇒ token ຂອງແອັບເອົາໄປໃຊ້ເປັນ cookie ຂອງເວັບບໍ່ໄດ້ ແລະ
 * ກັບກັນ (proxy ຂອງເວັບກວດ cookie ຢ່າງດຽວຢູ່ແລ້ວ ແຕ່ຖ້າມື້ໜ້າປ່ຽນ ອັນນີ້ກັນໄວ້ກ່ອນ).
 */

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "development-only-change-this-secret");
const AUDIENCE = "mobile";
const EXPIRY = "30d";

export async function createMobileToken(session: Session): Promise<string> {
  return new SignJWT({ username: session.username, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(AUDIENCE)
    .setExpirationTime(EXPIRY)
    .sign(secret);
}

export type MobileUser = Session & { role: Role };

/** ອ່ານ Bearer token ຈາກ header — null ຖ້າບໍ່ມີ/ບໍ່ຖືກຕ້ອງ/ໝົດອາຍຸ */
export async function mobileUser(request: Request): Promise<MobileUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { audience: AUDIENCE });
    if (typeof payload.username !== "string" || typeof payload.role !== "string") return null;
    const session = { username: payload.username, role: payload.role };
    return { ...session, role: roleOf(session) };
  } catch {
    return null;
  }
}

/**
 * ດ່ານມາດຕະຖານຂອງທຸກ route ໃນ /api/mobile — ຄືນ user ຫຼື ຄຳຕອບ 401/403.
 * ໃສ່ `allowed` ເພື່ອຈຳກັດ role (ຫວ່າງ = ທຸກຄົນທີ່ login ແລ້ວ).
 */
export async function requireMobile(
  request: Request,
  allowed?: readonly Role[],
): Promise<{ ok: true; user: MobileUser } | { ok: false; response: NextResponse }> {
  const user = await mobileUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "ຕ້ອງເຂົ້າສູ່ລະບົບໃໝ່" }, { status: 401 }) };
  }
  if (allowed && !allowed.includes(user.role)) {
    return { ok: false, response: NextResponse.json({ error: "ບໍ່ມີສິດເຮັດລາຍການນີ້" }, { status: 403 }) };
  }
  return { ok: true, user };
}

/** ຮູບ base64 — ເພດານດຽວກັບຝັ່ງ QC (ຮູບເກັບໃນຖານ ຈຶ່ງຕ້ອງຈຳກັດ) */
export const MAX_PHOTO_CHARS = 400_000;
