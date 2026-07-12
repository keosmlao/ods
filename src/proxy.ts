import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { canAccess, roleOf } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ດ່ານກຳນົດສິດ (ກຳນົດສິດ / RBAC) — ບ່ອນບັງຄັບໃຊ້ຈິງ.
 *
 * ເປັນຫຍັງຢູ່ບ່ອນນີ້ ບໍ່ແມ່ນຢູ່ (app)/layout.tsx?
 * layout ຂອງ Next ບໍ່ render ຄືນຕອນປ່ຽນໜ້າ (layout.md: "Layouts do not re-render on
 * navigation, so they do not access pathname") ⇒ ຖ້າກວດເສັ້ນທາງໃນ layout ຢ່າງດຽວ
 * ຄົນທີ່ກົດລິ້ງໄປໜ້າຕ້ອງຫ້າມຈະຜ່ານໄປໄດ້ ເພາະ layout ບໍ່ຖືກເອີ້ນຄືນ.
 * proxy ເຮັດວຽກກັບທຸກຄຳຂໍ (ທັງເປີດ URL ກົງ ແລະ RSC ຕອນປ່ຽນໜ້າ) ຈຶ່ງກັນໄດ້ຈິງ
 * ແລະ ຂັດກ່ອນ page ຈະ query ຖານຂໍ້ມູນ. (app)/layout.tsx ຍັງກວດຊ້ຳອີກຊັ້ນ.
 *
 * Next 16: middleware ປ່ຽນຊື່ເປັນ proxy ແລ້ວ ແລະ ແລ່ນເທິງ Node runtime
 * ຈຶ່ງໃຊ້ lib/auth (node:crypto, jose) ຮ່ວມກັນໄດ້.
 */

/**
 * ໜ້າສາທາລະນະ — ບໍ່ຕ້ອງ login (ລູກຄ້າ/QR ເປີດເອງ).
 *
 * ⚠ /pr-view ຖືກ **ຖອດອອກ** ຈາກລາຍການນີ້: ມັນສະແດງໃບຂໍສັ່ງຊື້ພ້ອມ **ລາຄາ**,
 * ຊື່ລູກຄ້າ ແລະ ຮູບເອກະສານແນບ ໂດຍບໍ່ຕ້ອງ login — ແລະ ເລກເອກະສານຮຽງຕາມລຳດັບ
 * (RQ2026070656) ຈຶ່ງເດົາໄດ້ງ່າຍ. ພິສູດແລ້ວວ່າເປີດອ່ານໄດ້ຈິງ.
 * ດຽວນີ້ຕ້ອງ login ກ່ອນ (ສິດຕາມກົດຂອງ /pr-view ໃນ lib/roles).
 */
const PUBLIC = ["/login", "/track", "/servicefuond", "/tracking", "/feedback"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/" || PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!canAccess(roleOf(session), pathname)) {
    const url = new URL("/forbidden", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // ບອກ pathname ໃຫ້ layout ຮູ້ ເພື່ອກວດຊ້ຳຝັ່ງ server
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // ຂ້າມ static, ຮູບ ແລະ ໄຟລ໌ໃນ public/ — ບໍ່ດັ່ງນັ້ນ CSS/JS ຈະຖືກກັນນຳ
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
