import { sendMail } from "@/lib/mail";
import { buildReport } from "@/lib/report-build";
import { recipientTargets } from "@/lib/report-recipient";
import { dueReports, markSent } from "@/lib/report-schedule";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ລາຍງານອັດຕະໂນມັດ. External cron ຍິງ **ຮາຍໂມງ**:
 *   curl -H "x-cron-key: $CRON_KEY" https://<host>/api/cron/reports
 * → ສົ່ງ report ທີ່ enabled + ຮອດເວລາ (send_time ໂມງ==ໂມງນີ້, ຍັງບໍ່ສົ່ງມື້ນີ້) ຫາຜູ້ຮັບ.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function pushLine(text: string, targets: string[]): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { sent: false, reason: "no LINE token" };
  if (!targets.length) return { sent: false, reason: "no line recipient" };
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
    const due = await dueReports();
    if (due.length === 0) return NextResponse.json({ ok: true, due: [], note: "ບໍ່ມີ report ຮອດເວລາ" });
    const parts = (await Promise.all(due.map(buildReport))).filter((x): x is string => !!x);
    const text = parts.join("\n\n");
    const { emails, lineIds } = await recipientTargets();
    const [line, email] = await Promise.all([
      pushLine(text, lineIds),
      sendMail({ to: emails.join(","), subject: `ລາຍງານ ${new Date().toLocaleDateString("en-GB")}`, text }),
    ]);
    await markSent(due);
    return NextResponse.json({ ok: true, due, text, line, email });
  } catch (error) {
    console.error("reports cron failed", error);
    return NextResponse.json({ error: "ສ້າງລາຍງານລົ້ມເຫຼວ" }, { status: 500 });
  }
}
