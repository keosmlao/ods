"use server";
import { logChange } from "@/lib/chatter-log";
import { db, query } from "@/lib/db";
import { requirePermission } from "@/lib/guard";
import { SALES_SIDE, SERVICE_SIDE } from "@/lib/roles";
import { collectUploads, saveUploads } from "@/lib/uploads";
import { unlink } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * ລຶບ **ຄຳແຈ້ງສ້ອມຂອງລູກຄ້າ** (tb_product_notice).
 *
 * ── ອັນນີ້ບໍ່ແມ່ນ "ງານ" ──
 * ການລຶບ **ງານ** (tb_product / ods_tb_install) ຍັງ **ຫ້າມເດັດຂາດ** ຕາມນະໂຍບາຍ
 * (deleteService/deleteInstall ຖືກຖອດອອກໄປແລ້ວ — ມັນເຄີຍລຶບໃບສະເໜີລາຄາ, ໃບເບີກ
 * ແລະ ໃບຮັບເງິນຕິດໄປນຳ ໂດຍທີ່ສະຕັອກ ERP ຖືກຕັດໄປແລ້ວ).
 *
 * ຄຳແຈ້ງ ຄື "ລູກຄ້າໂທມາແຈ້ງວ່າເຄື່ອງເສຍ" — ຍັງບໍ່ມີເອກະສານ, ບໍ່ມີສະຕັອກ, ບໍ່ມີເງິນ
 * ຜູກຢູ່ນຳ ⇒ ລຶບຖິ້ມໄດ້ (ຄຳແຈ້ງທົດລອງ/ຊ້ຳ/ຜິດ).
 *
 * ── ດ່ານດຽວທີ່ຕ້ອງມີ ──
 * ຄຳແຈ້ງທີ່ **ເປີດງານໄປແລ້ວ** ລຶບບໍ່ໄດ້ — ໃບຮັບເຄື່ອງອ້າງອີງມັນຢູ່ (tb_product.ref_notice)
 * ຖ້າລຶບ ໃບນັ້ນຈະຊີ້ໄປຫາຄຳແຈ້ງທີ່ບໍ່ມີຕົວຕົນ ແລະ ຕົ້ນທາງຂອງງານຈະຫາຍ.
 */
export type NoticeState = { error?: string; ok?: string };

export async function deleteNotice(code: string): Promise<NoticeState> {
  const guard = await requirePermission("/service/notices", "delete", SERVICE_SIDE, "ບໍ່ມີສິດລຶບຄຳແຈ້ງ");
  if (!guard.ok) return { error: guard.error };

  // ເປີດງານໄປແລ້ວ = ມີໃບຮັບເຄື່ອງອ້າງອີງຢູ່ ⇒ ລຶບບໍ່ໄດ້ (ເງື່ອນໄຂຢູ່ໃນ WHERE)
  const removed = await query<{ code: string; name_1: string | null; issue: string | null }>(
    `delete from tb_product_notice a
      where a.code = $1
        and not exists (select 1 from tb_product p where p.ref_notice = a.code)
      returning a.code, a.name_1, a.issue`,
    [code],
  );

  if (!removed.rowCount) {
    const opened = await query<{ code: string }>("select code from tb_product where ref_notice = $1 limit 1", [code]);
    return {
      error: opened.rowCount
        ? `ລຶບບໍ່ໄດ້ — ຄຳແຈ້ງນີ້ເປີດເປັນໃບຮັບເຄື່ອງ #${opened.rows[0].code} ໄປແລ້ວ`
        : "ບໍ່ພົບຄຳແຈ້ງນີ້",
    };
  }

  const row = removed.rows[0];
  // ຫຼັກຖານວ່າໃຜລຶບ ເມື່ອໃດ — ຕົວຄຳແຈ້ງຫາຍໄປແລ້ວ ຈຶ່ງບັນທຶກໃສ່ລູກຄ້າ… ບໍ່ມີລູກຄ້າແນ່ນອນ
  // ⇒ ບັນທຶກເປັນກິດຈະກຳຂອງຕົວຄຳແຈ້ງເອງ (ອ່ານໄດ້ຢູ່ໜ້າ "ກິດຈະກຳ")
  await logChange("tb_product_notice", code, `ລຶບຄຳແຈ້ງສ້ອມ: ${row.name_1 ?? "-"} · ${row.issue ?? "-"}`);

  revalidatePath("/service/notices");
  return { ok: `ລຶບຄຳແຈ້ງ ${code} ແລ້ວ` };
}

/* ---------- ສ້າງຄຳແຈ້ງສ້ອມ (ຝັ່ງລູກຄ້າສາທາລະນະ · ຝັ່ງພະນັກງານຂາຍ) ---------- */

/**
 * ── ບ່ອນ **ສ້າງ** notice ອັນທຳອິດຂອງແອັບນີ້ ──
 * ແຕ່ກ່ອນ tb_product_notice ຖືກ insert ໂດຍ ODS/PHP ເກົ່າເທົ່ານັ້ນ (/cppro_online).
 * ດຽວນີ້ 2 ທາງເຂົ້າ:
 *   - ລູກຄ້າ  → ຟອມສາທາລະນະ /report-repair (ບໍ່ຕ້ອງ login)
 *   - ຂາຍ    → /sales/report-repair (role sales)
 * ຫຼັງບັນທຶກ ຄຳແຈ້ງໂຜ່ຢູ່ /service/notices ໃຫ້ CS ແປງເປັນໃບຮັບເຄື່ອງຄືເກົ່າ.
 */
export type NoticeCreateState = { error?: string; ok?: string; code?: string };

const createSchema = z.object({
  mode: z.enum(["public", "sales"]).optional().default("public"),
  custname: z.string().trim().min(1),
  tel: z.string().trim().min(1),
  address: z.string().optional().default(""),
  provine: z.string().optional().default(""),
  city: z.string().optional().default(""),
  proname: z.string().trim().min(1),
  pro_sn: z.string().optional().default(""),
  pro_brand: z.string().optional().default(""),
  pro_model: z.string().optional().default(""),
  pro_type: z.string().optional().default(""),
  service_type: z.string().optional().default(""),
  pro_issue: z.string().trim().min(1),
  pro_remark: z.string().optional().default(""),
});

const CREATE_FIELD_LABEL: Record<string, string> = {
  custname: "ຊື່ລູກຄ້າ",
  tel: "ເບີໂທ",
  proname: "ຊື່ເຄື່ອງ",
  pro_issue: "ອາການເບື້ອງຕົ້ນ",
};

export async function createNotice(_: NoticeCreateState, formData: FormData): Promise<NoticeCreateState> {
  const parsed = createSchema.safeParse(
    Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")),
  );
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
      .map((key) => CREATE_FIELD_LABEL[key] ?? key);
    return { error: `ກະລຸນາປ້ອນ: ${names.join(", ")}` };
  }
  const d = parsed.data;

  // ຝັ່ງພະນັກງານຂາຍ ຕ້ອງມີສິດ — ຝັ່ງລູກຄ້າ (public) ບໍ່ຕ້ອງ login
  let salesBy = "";
  if (d.mode === "sales") {
    const guard = await requirePermission("/sales", "create", SALES_SIDE, "ບໍ່ມີສິດແຈ້ງສ້ອມ");
    if (!guard.ok) return { error: guard.error };
    salesBy = guard.session.username;
  }

  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const files = await collectUploads(formData);
  if (!files.ok) return { error: files.error };

  const client = await db.connect();
  const written: string[] = [];
  let code = "";

  try {
    await client.query("begin");
    // ລັອກ ກັນສອງຄົນແຈ້ງພ້ອມກັນແລ້ວໄດ້ເລກຊ້ຳ (ຄົນລະ key ກັບໃບຮັບເຄື່ອງ 734210)
    await client.query("select pg_advisory_xact_lock(734211)");

    // ຜູກໃສ່ລູກຄ້າເກົ່າຖ້າເບີໂທຕົງ → ຟອມແປງເປັນໃບຮັບຈະດຶງຊື່/ທີ່ຢູ່ລູກຄ້າຂຶ້ນມາໃຫ້
    const linked = await client.query<{ ref_code: string }>(
      `select ref_code from ar_customer
        where replace(lower(coalesce(tel,'')),' ','') = replace(lower($1),' ','')
          and coalesce(ref_code,'') <> ''
        order by code limit 1`,
      [d.tel],
    );
    const refCode = linked.rows[0]?.ref_code ?? null;

    code = String(
      (await client.query<{ code: number }>(
        "select coalesce(max(code::int),0)+1 code from tb_product_notice where code ~ '^[0-9]+$'",
      )).rows[0].code,
    );

    await client.query(
      `insert into tb_product_notice
         (code, time_notice, creator_name, telephone, name_1, sn, issue, remark,
          p_brand, p_model, service_type, ref_code, provine, city)
       values ($1, localtimestamp, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, nullif($12,''), nullif($13,''))`,
      [code, d.custname, d.tel, d.proname, d.pro_sn, d.pro_issue, d.pro_remark,
        d.pro_brand, d.pro_model, d.service_type, refCode, d.provine, d.city],
    );

    // ຮູບຂອງຄຳແຈ້ງຜູກດ້ວຍ ref_code = ລະຫັດຄຳແຈ້ງ (ຄືກັບ ods; ຕອນແປງເປັນໃບຮັບຈຶ່ງຍ້າຍເປັນ iteme_code)
    await saveUploads(client, code, files.uploads, written, "ref_code");

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    await Promise.all(written.map((path) => unlink(path).catch(() => {})));
    console.error("Create notice failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາລອງໃໝ່" };
  } finally {
    client.release();
  }

  const item = [d.proname, d.pro_brand, d.pro_model].filter(Boolean).join(" ");
  await logChange(
    "tb_product_notice",
    code,
    d.mode === "sales"
      ? `ພະນັກງານຂາຍ (${salesBy}) ແຈ້ງສ້ອມແທນລູກຄ້າ ${d.custname}: ${item} · ອາການ: ${d.pro_issue}`
      : `ລູກຄ້າ ${d.custname} ແຈ້ງສ້ອມອອນລາຍ: ${item} · ອາການ: ${d.pro_issue}`,
  );

  revalidatePath("/service/notices");
  return { ok: `ຮັບຄຳແຈ້ງແລ້ວ`, code };
}
