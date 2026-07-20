import nodemailer from "nodemailer";

export type MailResult = { sent: boolean; reason?: string };

/**
 * ສ່ງ email ຜ່ານ SMTP (hosting odienmall.com). ເຮັດວຽກເມື່ອຕັ້ງ env ຄົບ:
 *   SMTP_HOST · SMTP_PORT (ຄ່າຕັ້ງຕົ້ນ 587) · SMTP_USER · SMTP_PASS · MAIL_FROM
 * ບໍ່ຕັ້ງ = ຄືນ { sent:false } (ບໍ່ throw) — ໃຫ້ cron ດຳເນີນຕໍ່ໄດ້.
 */
export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<MailResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM ?? user;
  if (!host || !user || !pass || !from) return { sent: false, reason: "SMTP env ບໍ່ໄດ້ຕັ້ງ" };
  if (!opts.to.trim()) return { sent: false, reason: "ບໍ່ມີຜູ້ຮັບ (MAIL_TO)" };
  const port = Number(process.env.SMTP_PORT ?? 587);
  try {
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transport.sendMail({ from, to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
    return { sent: true };
  } catch (error) {
    console.error("sendMail failed", error);
    return { sent: false, reason: "SMTP ສ່ງລົ້ມເຫຼວ" };
  }
}
