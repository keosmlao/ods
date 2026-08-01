import { createSession } from "@/lib/auth";
import {
  createMobileWebTicket,
  requireMobile,
  verifyMobileWebTicket,
} from "@/lib/mobile-auth";
import { APPROVER_SIDE } from "@/lib/roles";
import { NextResponse } from "next/server";

const ALLOWED_PATHS = [
  "/approvals/purchase-requests",
  "/approvals/purchase-orders",
  "/purchase-orders/",
];

function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  const path = value.split("?", 1)[0];
  return ALLOWED_PATHS.some((allowed) =>
    allowed.endsWith("/") ? path.startsWith(allowed) : path === allowed,
  ) ? value : null;
}

/** ແອັບຂໍ launch URL ດ້ວຍ Bearer token; mobile token ບໍ່ເຄີຍຖືກໃສ່ໃນ URL. */
export async function POST(request: Request) {
  const guard = await requireMobile(request, APPROVER_SIDE);
  if (!guard.ok) return guard.response;

  let body: { href?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" }, { status: 400 });
  }

  const href = safeHref(body.href);
  if (!href) return NextResponse.json({ error: "ບໍ່ອະນຸຍາດໜ້າ Web ນີ້" }, { status: 400 });

  const ticket = await createMobileWebTicket(guard.user, href);
  const launchUrl = new URL("/api/mobile/web-session", request.url);
  launchUrl.searchParams.set("ticket", ticket);
  return NextResponse.json(
    { launch_url: launchUrl.toString() },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Browser ແລກ ticket 60 ວິນາທີເປັນ httpOnly web session ແລ້ວໄປໜ້າທີ່ຜູກໄວ້. */
export async function GET(request: Request) {
  const ticket = new URL(request.url).searchParams.get("ticket") ?? "";
  const payload = await verifyMobileWebTicket(ticket);
  const href = payload && safeHref(payload.href);
  if (!payload || !href) {
    return NextResponse.redirect(new URL("/login", request.url), {
      headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
    });
  }

  await createSession(payload.session);
  return NextResponse.redirect(new URL(href, request.url), {
    headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
