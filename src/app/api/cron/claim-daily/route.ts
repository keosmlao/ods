import { claimDailySummary, claimDailyText } from "@/lib/claim";
import { sendMail } from "@/lib/mail";
import { recipientTargets } from "@/lib/report-recipient";
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

async function pushLine(text: string, targets: string[]): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { sent: false, reason: "LINE_CHANNEL_ACCESS_TOKEN ບໍ່ໄດ້ຕັ້ງ" };
  if (targets.length === 0) return { sent: false, reason: "ບໍ່ມີຜູ້ຮັບ Line" };
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
    // ຜູ້ຮັບ: ຈาก UI (/manage/report-recipients) ກ່ອນ, ວ່າງ ⇒ fallback env
    const { emails, lineIds } = await recipientTargets();
    const mailTo = emails.length ? emails.join(",") : (process.env.MAIL_TO ?? "");
    const lineTo = lineIds.length ? lineIds : (process.env.LINE_NOTIFY_TO?.split(",").map((t) => t.trim()).filter(Boolean) ?? []);
    const [line, email] = await Promise.all([
      pushLine(text, lineTo),
      sendMail({ to: mailTo, subject: `ສະຫຼຸບເຄມ ${date}`, text }),
    ]);
    return NextResponse.json({ ok: true, summary, text, line, email });
  } catch (error) {
    console.error("claim-daily cron failed", error);
    return NextResponse.json({ error: "ສ້າງສະຫຼຸບລົ້ມເຫຼວ" }, { status: 500 });
  }
}
