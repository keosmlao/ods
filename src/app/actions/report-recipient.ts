"use server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { sendMail } from "@/lib/mail";
import { APPROVER_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type RecipientState = { error?: string };
export type TestMailState = { ok?: boolean; error?: string };
const PATH = "/manage/report-recipients";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function addRecipient(channel: string, target: string, name: string): Promise<RecipientState> {
  const g = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດຈັດການຜູ້ຮັບ");
  if (!g.ok) return { error: g.error };
  const c = channel === "line" ? "line" : "email";
  const t = target.trim();
  if (!t) return { error: "ໃສ່ email / Line id" };
  if (c === "email" && !EMAIL_RE.test(t)) return { error: "email ບໍ່ຖືກຮູບແບບ" };
  await query(
    `insert into ods_report_recipient(report, channel, target, name, created_by)
       values ('claim', $1, $2, nullif($3,''), $4)
     on conflict (report, channel, target) do update set active = true, name = excluded.name`,
    [c, t, name.trim(), g.session.username],
  );
  revalidatePath(PATH);
  return {};
}

export async function removeRecipient(id: number): Promise<RecipientState> {
  const g = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດ");
  if (!g.ok) return { error: g.error };
  await query(`delete from ods_report_recipient where id = $1`, [id]);
  revalidatePath(PATH);
  return {};
}

/** ທົດສອບການຕັ້ງຄ່າ SMTP — ສ່ງ email ທົດສอບໄປຫາ address ດຽວ. */
export async function sendTestMail(target: string): Promise<TestMailState> {
  const g = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດທົດສອບ");
  if (!g.ok) return { error: g.error };
  const t = target.trim();
  if (!t || !EMAIL_RE.test(t)) return { error: "email ບໍ່ຖືກຮູບແບບ" };
  const now = new Date().toLocaleString("en-GB", { timeZone: "Asia/Vientiane" });
  const res = await sendMail({
    to: t,
    subject: "[ODSS] ທົດສອບການສ່ງ email",
    text: `ນີ້ແມ່ນ email ທົດສອບຈາກ ODSS.\nຖ້າທ່ານໄດ້ຮັບສະບັບນີ້ = ການຕັ້ງຄ່າ SMTP ໃຊ້ໄດ້.\n\nສ່ງໂດຍ: ${g.session.username}\nເວລາ: ${now}`,
    html: `<div style="font-family:sans-serif;line-height:1.6"><p><b>ນີ້ແມ່ນ email ທົດສອບຈາກ ODSS.</b></p><p>ຖ້າທ່ານໄດ້ຮັບສະບັບນີ້ = ການຕັ້ງຄ່າ SMTP ໃຊ້ໄດ້. ✅</p><hr><p style="color:#64748b;font-size:13px">ສ່ງໂດຍ: ${g.session.username} · ${now}</p></div>`,
  });
  if (!res.sent) return { error: res.reason ?? "ສ່ງບໍ່ສຳເລັດ" };
  return { ok: true };
}

export async function toggleRecipient(id: number, active: boolean): Promise<RecipientState> {
  const g = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດ");
  if (!g.ok) return { error: g.error };
  await query(`update ods_report_recipient set active = $1 where id = $2`, [active, id]);
  revalidatePath(PATH);
  return {};
}
