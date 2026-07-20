import { claimDailySummary, claimDailyText } from "@/lib/claim";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ແຈ້ງເຕືອນເຄມປະຈຳວັນ (Phase 3). External cron ຍິງ:
 *   curl -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/claim-daily
 * → ສ້າງສະຫຼຸບເຄມ → push Line OA (ຖ້າ LINE env ຕັ້ງ) + email (ລໍ SMTP odienmall.com).
 *
 * env: CRON_KEY · LINE_CHANNEL_ACCESS_TOKEN · LINE_NOTIFY_TO (userId/groupId, ຄັ່ນ ,)
 *      (email: SMTP_HOST/PORT/USER/PASS/MAIL_FROM/MAIL_TO — ຕໍ່ເມື່ອຕິດຕັ້ງ nodemailer)
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function pushLine(text: string): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_NOTIFY_TO;
  if (!token || !to) return { sent: false, reason: "LINE env ບໍ່ໄດ້ຕັ້ງ" };
  const targets = to.split(",").map((t) => t.trim()).filter(Boolean);
  const results = await Promise.all(
    targets.map(async (id) => {
      try {
        const r = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ to: id, messages: [{ type: "text", text }] }),
        });
        return r.ok;
      } catch {
        return false;
      }
    }),
  );
  return { sent: results.some(Boolean) };
}

export async function GET(request: NextRequest) {
  const key = process.env.CRON_KEY;
  if (!key) return NextResponse.json({ error: "CRON_KEY ບໍ່ໄດ້ຕັ້ງ" }, { status: 401 });
  if (request.headers.get("x-cron-key") !== key) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const date = new Date().toLocaleDateString("en-GB");
    const summary = await claimDailySummary();
    const text = claimDailyText(summary, date);
    const line = await pushLine(text);
    // email: ລໍຕິດຕັ້ງ nodemailer + SMTP odienmall.com (Phase 3b)
    return NextResponse.json({ ok: true, summary, text, line, email: { sent: false, reason: "ລໍ SMTP setup (odienmall.com)" } });
  } catch (error) {
    console.error("claim-daily cron failed", error);
    return NextResponse.json({ error: "ສ້າງສະຫຼຸບລົ້ມເຫຼວ" }, { status: 500 });
  }
}
