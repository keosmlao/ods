"use server";
import { logChange } from "@/app/actions/chatter";
import { getSession } from "@/lib/auth";
import { ROLE_WAREHOUSE } from "@/lib/chatter";
import { db, odgDb, query } from "@/lib/db";
import { nextDocNo } from "@/lib/doc-no";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/* ─────────────────────────────────────────────────────────────
   Server actions ຂອງ ວຽກຕິດຕັ້ງ
   ຖອດແບບຈາກ ods: install_admin.py, tech_install.py, tech_reg_install.py
   • ທຸກ query ໃຊ້ parameter ($1,$2...) — ບໍ່ຕໍ່ string ເຂົ້າ SQL
     (ods ມີຊ່ອງໂຫວ່ SQL injection ຢູ່ tech_install.py:157 ແລະ
      tech_reg_install.py:355 ທີ່ຕໍ່ session name ເຂົ້າ SQL ໂດຍກົງ)
   • ບໍ່ໄດ້ຄັດລອກການແຈ້ງເຕືອນ LINE Notify ມາ
   ───────────────────────────────────────────────────────────── */

export type ActionState = { error?: string; ok?: string };

const INSTALL_PATHS = [
  "/installations",
  "/installations/all",
  "/installations/assign",
  "/installations/accept",
  "/installations/work",
  "/installations/close",
  "/installations/spare-requests",
  "/installations/spare-pickup",
  "/installations/dispatch",
];

function revalidateAll() {
  for (const path of INSTALL_PATHS) revalidatePath(path);
}

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** ຊ່າງເຫັນສະເພາະງານຂອງຕົນ — ຄືກັບ ods (roles == 'technical') */
export async function techFilter() {
  const session = await requireSession();
  return session.role === "technical" ? session.username : null;
}

/* ── ເປີດງານຕິດຕັ້ງ (save_install_create) ─────────────────── */

const createSchema = z.object({
  doc_no: z.string().min(1),
  billdate: z.string().min(1),
  item_code: z.string().min(1),
  item_name: z.string().min(1),
  sv_type: z.string(),
  cust_code: z.string().min(1),
  custname: z.string().min(1),
  tel: z.string(),
  address: z.string(),
  pro_brand: z.string(),
  pro_model: z.string().min(1),
  pro_type: z.string().min(1),
  pro_size: z.string().min(1),
  pro_sn: z.string().min(1),
  location_inst: z.string(),
  remark: z.string(),
});

export async function createInstall(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ກະລຸນາປ້ອນຊ່ອງທີ່ຈຳເປັນໃຫ້ຄົບ" };
  const d = parsed.data;

  const client = await db.connect();
  let code = "";
  try {
    await client.query("begin");
    // ods ໃຊ້ max()+1 ໂດຍບໍ່ລັອກ → ສອງຄົນເປີດງານພ້ອມກັນໄດ້ເລກຊ້ຳ. ບ່ອນນີ້ລັອກກ່ອນ.
    await client.query("select pg_advisory_xact_lock(734211)");

    // ລູກຄ້າ: ຖ້າມີ ref_code ນີ້ຢູ່ແລ້ວໃຊ້ອັນເກົ່າ, ບໍ່ດັ່ງນັ້ນສ້າງໃໝ່
    const existing = await client.query<{ code: string }>(
      "select code from ar_customer where lower(ref_code)=lower($1) limit 1",
      [d.cust_code],
    );
    let custCode: string;
    if (existing.rows[0]) {
      custCode = existing.rows[0].code;
    } else {
      const next = await client.query<{ max: number | null }>("select max(code::int) max from ar_customer");
      custCode = String((next.rows[0].max ?? 0) + 1);
      await client.query(
        "insert into ar_customer(code,name_1,address,city,provine,tel,ref_code) values($1,$2,$3,null,null,$4,$5)",
        [custCode, d.custname, d.address, d.tel, d.cust_code],
      );
    }

    // ອາໄຫຼ່ມາດຕະຖານຂອງປະເພດຕິດຕັ້ງນີ້
    const lines = await client.query<{
      line_number: number; ic_code: string; name_1: string; qty: string; unit_code: string;
    }>(
      "select line_number,ic_code,name_1,round(qty,2) qty,unit_code from used_spare_install where install_type=$1 order by line_number",
      [d.sv_type],
    );

    const seq = await client.query<{ max: number | null }>(
      "select max(nullif(regexp_replace(code,'\\D','','g'),'')::int) max from ods_tb_install",
    );
    code = `INST-${(seq.rows[0].max ?? 0) + 1}`;

    // ສິນຄ້າລະຫັດຂຶ້ນຕົ້ນ '97' ບໍ່ໃຊ້ອາໄຫຼ່ (ຄືກັບ ods)
    const usedSpare = lines.rowCount === 0 || d.item_code.slice(0, 2) === "97" ? 0 : 1;

    const category = await client.query<{ name_1: string }>("select name_1 from tb_category where code=$1", [d.pro_type]);
    const proTypeName = category.rows[0]?.name_1 ?? "";

    await client.query(
      `insert into ods_tb_install(code,doc_ref_1,cust_code,item_code,item_name,install_type,status,complain_status,
         remark,time_register,user_created,doc_ref_date,pro_brand,pro_model,pro_type,pro_size,location_inst,
         used_spare,pro_sn,pro_type_code)
       values($1,$2,$3,$4,$5,$6,0,0,$7,localtimestamp(0),$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [code, d.doc_no, custCode, d.item_code, d.item_name, d.sv_type, d.remark, session.username, d.billdate,
        d.pro_brand, d.pro_model, proTypeName, d.pro_size, d.location_inst, usedSpare, d.pro_sn, d.pro_type],
    );

    for (const line of lines.rows) {
      await client.query(
        `insert into ods_tb_install_detail(line_number,code,cust_code,time_register,item_code,item_name,qty,unit_code)
         values($1,$2,$3,localtimestamp(0),$4,$5,$6,$7)`,
        [line.line_number, code, custCode, line.ic_code, line.name_1, line.qty, line.unit_code],
      );
      await client.query(
        "insert into tb_used_spare(product_code,item_code,item_name,qty,unit_code) values($1,$2,$3,$4,$5)",
        [code, line.ic_code, line.name_1, line.qty, line.unit_code],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("createInstall failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ ກະລຸນາກວດຂໍ້ມູນ" };
  } finally {
    client.release();
  }

  await logChange(
    "ods_tb_install",
    code,
    `ເປີດງານຕິດຕັ້ງ: ${d.item_name} · ລູກຄ້າ ${d.custname} · ບິນອ້າງອີງ ${d.doc_no}`,
  );

  revalidateAll();
  redirect("/installations");
}

/* ── ແກ້ໄຂງານ (edit_save_install) ─────────────────────────── */

const editSchema = z.object({
  code: z.string().min(1),
  tech_code: z.string(),
  appoint_date: z.string(),
  location_inst: z.string(),
  pro_sn: z.string(),
  pro_type: z.string(),
  pro_model: z.string(),
  pro_brand: z.string(),
  remark: z.string(),
});

export async function updateInstall(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  const d = parsed.data;

  try {
    const category = await query<{ name_1: string }>("select name_1 from tb_category where code=$1", [d.pro_type]);
    await query(
      `update ods_tb_install set remark=$1, user_edit=$2, tech_code=$3, appoint_date=$4, location_inst=$5,
         pro_sn=$6, pro_type=$7, pro_type_code=$8, pro_model=$9, pro_brand=$10
       where code=$11`,
      [d.remark, session.username, d.tech_code || null, d.appoint_date || null, d.location_inst, d.pro_sn,
        category.rows[0]?.name_1 ?? "", d.pro_type, d.pro_model, d.pro_brand, d.code],
    );
  } catch (error) {
    console.error("updateInstall failed", error);
    return { error: "ເເກ້ໄຂບໍ່ສຳເລັດ" };
  }

  const detail = [
    d.tech_code && `ຊ່າງ ${d.tech_code}`,
    d.appoint_date && `ນັດວັນທີ ${d.appoint_date}`,
    d.location_inst && `ສະຖານທີ່ ${d.location_inst}`,
  ]
    .filter(Boolean)
    .join(" · ");
  // ຖ້າແກ້ໄຂແລ້ວມີຊ່າງ → ຊ່າງຄົນນັ້ນຮູ້ນຳ
  await logChange("ods_tb_install", d.code, `ແກ້ໄຂງານຕິດຕັ້ງ${detail ? `: ${detail}` : ""}`, {
    users: d.tech_code ? [d.tech_code] : [],
  });

  revalidateAll();
  redirect("/installations");
}

/* ── ລົບງານ (del_installjob) ──────────────────────────────── */

export async function deleteInstall(code: string): Promise<ActionState> {
  await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const client = await db.connect();
  try {
    await client.query("begin");
    // ຖືກໃຊ້ໃນເອກະສານແລ້ວ ຫຼື ຊ່າງຮັບງານ/ເລີ່ມແລ້ວ → ລົບບໍ່ໄດ້
    const used = await client.query<{ count: string }>(
      "select count(roworder) count from ic_trans where product_code=$1",
      [code],
    );
    const started = await client.query<{ count: string }>(
      `select count(roworder) count from ods_tb_install
       where code=$1 and (tech_confirm is not null or tech_code is not null or start_install is not null)`,
      [code],
    );
    if (Number(used.rows[0].count) !== 0 || Number(started.rows[0].count) !== 0) {
      await client.query("rollback");
      return { error: "ບໍ່ສາມາດລົບໄດ້ ຂໍ້ມູນຖືກໃຊ້ເເລ້ວ!" };
    }
    await client.query("delete from ods_tb_install where code=$1", [code]);
    await client.query("delete from ods_tb_install_detail where code=$1", [code]);
    await client.query("delete from tb_used_spare where product_code=$1", [code]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("deleteInstall failed", error);
    return { error: "ລົບບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  revalidateAll();
  return { ok: "ລົບສຳເລັດ" };
}

/* ── ຍົກເລີກງານ (cancel_install) ──────────────────────────── */

export async function cancelInstall(code: string, remark: string): Promise<ActionState> {
  const session = await requireSession();
  if (!remark.trim()) return { error: "ກະລຸນາໃສ່ຫມາຍເຫດ" };
  let cancelled = false;
  try {
    const done = await query(
      `update ods_tb_install set cancel_date=localtimestamp(0), cancel_remark=$1, cancel_code=$2
       where code=$3 and cancel_date is null`,
      [remark.trim(), session.username, code],
    );
    cancelled = Boolean(done.rowCount);
  } catch (error) {
    console.error("cancelInstall failed", error);
    return { error: "ຍົກເລີກບໍ່ສຳເລັດ" };
  }
  if (cancelled) await logChange("ods_tb_install", code, `ຍົກເລີກງານຕິດຕັ້ງ: ${remark.trim()}`);
  revalidateAll();
  return { ok: "ຍົກເລີກສຳເລັດ" };
}

/* ── ຈັດຊ່າງ (assign_tech_submit / choose_new_tech) ───────── */

export async function assignTech(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  const code = String(formData.get("code") ?? "");
  const techCode = String(formData.get("tech_code") ?? "");
  const appointDate = String(formData.get("appoint_date") ?? "");
  const locationInst = String(formData.get("location_inst") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!code || !techCode) return { error: "ກະລຸນາເລືອກຊ່າງ" };

  try {
    await query(
      "update ods_tb_install set remark=$1, tech_code=$2, appoint_date=$3, location_inst=$4 where code=$5",
      [remark, techCode, appointDate || null, locationInst, code],
    );
  } catch (error) {
    console.error("assignTech failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  }

  // ແຈ້ງຊ່າງວ່າມີງານໃໝ່ (ods ຍິງ LINE Notify ຢູ່ຈຸດນີ້)
  await logChange(
    "ods_tb_install",
    code,
    `ຈັດຊ່າງ: ${techCode}${appointDate ? ` · ນັດວັນທີ ${appointDate}` : ""}${locationInst ? ` · ${locationInst}` : ""}`,
    { users: [techCode] },
  );

  revalidateAll();
  return { ok: "ສຳເລັດ" };
}

/** ເລືອກຊ່າງໃໝ່ — ເກັບຊ່າງເກົ່າໄວ້ໃນ tech_before ແລ້ວລ້າງ tech_code */
export async function chooseNewTech(code: string): Promise<ActionState> {
  await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  try {
    await client.query("begin");
    const confirmed = await client.query<{ count: string }>(
      "select count(roworder) count from ods_tb_install where code=$1 and tech_confirm is not null",
      [code],
    );
    if (Number(confirmed.rows[0].count) !== 0) {
      await client.query("rollback");
      return { error: "ບໍ່ສາມາດເລືອກໃໝ່ໄດ້ ຊ່າງຮັບເເລ້ວ!" };
    }
    await client.query("update ods_tb_install set tech_before=tech_code where code=$1", [code]);
    await client.query("update ods_tb_install set tech_confirm=null, tech_code=null where code=$1", [code]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("chooseNewTech failed", error);
    return { error: "ບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("ods_tb_install", code, "ຖອນຊ່າງອອກ — ລໍຖ້າຈັດຊ່າງໃໝ່");
  revalidateAll();
  return { ok: "ສຳເລັດ" };
}

/* ── ຊ່າງຮັບງານ (tech_accept_*) ───────────────────────────── */

export async function acceptJob(code: string): Promise<ActionState> {
  await requireSession();
  await query("update ods_tb_install set tech_confirm=localtimestamp(0) where code=$1", [code]);
  await logChange("ods_tb_install", code, "ຊ່າງຮັບງານແລ້ວ");
  revalidateAll();
  return { ok: `ຮັບງານຕິດຕັ້ງ ເລກທີ ${code} ສຳເລັດ` };
}

/** ຍົກເລີກການຮັບງານ — ຍັງເປັນຊ່າງຄົນເກົ່າ */
export async function unacceptJob(code: string): Promise<ActionState> {
  await requireSession();
  await query("update ods_tb_install set tech_confirm=null where code=$1", [code]);
  await logChange("ods_tb_install", code, "ຊ່າງຖອນການຮັບງານ");
  revalidateAll();
  return { ok: `ຍົກເລີກຮັບງານ ເລກທີ ${code} ສຳເລັດ` };
}

/** ບໍ່ຮັບງານ — ຄືນງານໄປລໍຖ້າຈັດຊ່າງໃໝ່ */
export async function declineJob(code: string): Promise<ActionState> {
  await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query("update ods_tb_install set tech_before=tech_code where code=$1", [code]);
    await client.query("update ods_tb_install set tech_confirm=null, tech_code=null where code=$1", [code]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("declineJob failed", error);
    return { error: "ບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("ods_tb_install", code, "ຊ່າງບໍ່ຮັບງານ — ຄືນໄປລໍຖ້າຈັດຊ່າງໃໝ່");
  revalidateAll();
  return { ok: `ຍົກເລີກຮັບງານ ເລກທີ ${code} ສຳເລັດ` };
}

/* ── ຕິດຕັ້ງ (start/finish_tech_install) ──────────────────── */

export async function startInstall(code: string): Promise<ActionState> {
  await requireSession();
  await query("update ods_tb_install set start_install=localtimestamp(0) where code=$1", [code]);
  await logChange("ods_tb_install", code, "ເລີ່ມຕິດຕັ້ງ");
  revalidateAll();
  return { ok: `ເລີ່ມຕິດຕັ້ງ ເລກທີ ${code}` };
}

export async function finishInstall(code: string): Promise<ActionState> {
  await requireSession();
  await query("update ods_tb_install set finish_install=localtimestamp(0) where code=$1", [code]);
  // ຜູ້ຕິດຕາມຮູ້ວ່າຕິດຕັ້ງແລ້ວ. ລິ້ງແບບສອບຖາມຍັງຕ້ອງສົ່ງໃຫ້ລູກຄ້າດ້ວຍມື —
  // ລູກຄ້າບໍ່ມີບັນຊີໃນລະບົບ ຈຶ່ງແຈ້ງເຕືອນໃນແອັບຫາລູກຄ້າບໍ່ໄດ້ (ods ໃຊ້ LINE)
  await logChange("ods_tb_install", code, "ຕິດຕັ້ງສຳເລັດ — ລໍຖ້າລູກຄ້າຕອບແບບສອບຖາມ");
  revalidateAll();
  return { ok: `ຕິດຕັ້ງ ເລກທີ ${code} ສຳເລັດ` };
}

/* ── ປິດງານ (close_pending_success) ───────────────────────── */

export async function closeJob(code: string): Promise<ActionState> {
  await requireSession();
  await query("update ods_tb_install set job_finish=localtimestamp(0) where code=$1", [code]);
  await logChange("ods_tb_install", code, "ປິດງານຕິດຕັ້ງ");
  revalidateAll();
  return { ok: "ສຳເລັດ" };
}

/* ── ໃບຂໍເບີກ SION (tech_reg_install.py) ──────────────────── */

/** ເພີ່ມອາໄຫຼ່ເຂົ້າໃບຂໍເບີກ (additemtoreg_inst) */
export async function addSpareLine(code: string, itemCode: string, itemName: string, unitCode: string) {
  await requireSession();
  await query(
    "insert into tb_used_spare(product_code,item_code,item_name,qty,unit_code) values($1,$2,$3,1,$4)",
    [code, itemCode, itemName, unitCode],
  );
  revalidatePath(`/installations/spare-requests/${code}`);
  return { ok: "ສຳເລັດ" } satisfies ActionState;
}

/** ລົບແຖວອາໄຫຼ່ (delete_item_sion) */
export async function deleteSpareLine(code: string, roworder: number) {
  await requireSession();
  await query("delete from tb_used_spare where roworder=$1", [roworder]);
  revalidatePath(`/installations/spare-requests/${code}`);
  return { ok: "ສຳເລັດ" } satisfies ActionState;
}

/** ແກ້ຈຳນວນ (update_qty_reg_spare) */
export async function updateSpareQty(code: string, roworder: number, qty: number) {
  await requireSession();
  if (!Number.isFinite(qty) || qty <= 0) return { error: "ຈຳນວນບໍ່ຖືກຕ້ອງ" } satisfies ActionState;
  await query("update tb_used_spare set qty=round($1,2) where roworder=$2", [qty, roworder]);
  revalidatePath(`/installations/spare-requests/${code}`);
  return { ok: "ສຳເລັດ" } satisfies ActionState;
}

/** ບັນທຶກໃບຂໍເບີກ SION (save_in_req) — trans_flag 122 */
export async function saveSpareRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const productCode = String(formData.get("product_code") ?? "");
  const docDate = String(formData.get("doc_date") ?? "");
  const whCode = String(formData.get("wh_code") ?? "");
  const shelfCode = String(formData.get("shelf_code") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!productCode || !docDate || !whCode) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  const client = await db.connect();
  let requestNo = "";
  let requestLines = 0;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734212)");

    const lines = await client.query<{
      roworder: number; item_code: string; item_name: string; qty: string; unit_code: string;
    }>(
      `select roworder,item_code,item_name,round(qty,2) qty,unit_code from tb_used_spare
       where product_code=$1 order by roworder asc`,
      [productCode],
    );
    if (lines.rowCount === 0) {
      await client.query("rollback");
      return { error: "ບໍ່ມີລາຍການສຳລັບເບີກ!" };
    }

    // ອອກເລກ SION ພາຍໃນ lock — ods ອອກນອກ lock ຈຶ່ງຊ້ຳໄດ້
    const docNo = await nextDocNo(client, "SION");
    requestNo = docNo;
    requestLines = lines.rows.length;

    await client.query(
      `insert into ic_trans(trans_flag,doc_date,doc_no,product_code,remark,status,used_status,user_created,job_type,wh_code,shelf_code)
       values(122,$1,$2,$3,$4,0,1,$5,'install',$6,$7)`,
      [docDate, docNo, productCode, remark, session.username, whCode, shelfCode],
    );

    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag,doc_date,doc_no,product_code,item_code,item_name,qty,unit_code,calc_flag,status,user_created,job_type)
         values(122,$1,$2,$3,$4,$5,$6,$7,1,0,$8,'install')`,
        [docDate, docNo, productCode, line.item_code, line.item_name, line.qty, line.unit_code, session.username],
      );
      await client.query("update tb_used_spare set reg_start=localtimestamp(0) where roworder=$1", [line.roworder]);
    }

    await client.query("update ods_tb_install set reg_start=localtimestamp(0) where code=$1", [productCode]);
    await client.query("update ods_tb_install_detail set reg_start=localtimestamp(0) where code=$1", [productCode]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveSpareRequest failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  // ສາງຕ້ອງເບີກອາໄຫຼ່ໃຫ້ (ods ຍິງ LINE Notify ຫາສາງຢູ່ຈຸດນີ້)
  await logChange(
    "ods_tb_install",
    productCode,
    `ສ້າງໃບຂໍເບີກ ${requestNo} · ອາໄຫຼ່ ${requestLines} ລາຍການ${remark ? ` · ${remark}` : ""}`,
    { roles: ROLE_WAREHOUSE },
  );

  revalidateAll();
  redirect("/installations/spare-requests");
}

/** ລົບໃບຂໍເບີກ (delete_in_req) */
export async function deleteSpareRequest(docNo: string, code: string): Promise<ActionState> {
  await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const client = await db.connect();
  try {
    await client.query("begin");
    // ຖ້າສາງເບີກ (SWC) ອ້າງອີງໃບນີ້ແລ້ວ → ລົບບໍ່ໄດ້
    const used = await client.query<{ count: string }>(
      "select count(doc_no) count from ic_trans where doc_ref=$1",
      [docNo],
    );
    if (Number(used.rows[0].count) !== 0) {
      await client.query("rollback");
      return { error: `ບໍ່ສາມາດລົບເລກທີຂໍເບີກ ${docNo} ນີ້ໂດ້` };
    }
    await client.query("delete from ic_trans where doc_no=$1", [docNo]);
    await client.query("delete from ic_trans_detail where doc_no=$1", [docNo]);
    await client.query("update ods_tb_install set reg_start=null where code=$1", [code]);
    await client.query("update ods_tb_install_detail set reg_start=null where code=$1", [code]);
    // ods ລືມລ້າງ reg_start ຂອງ tb_used_spare → ຂໍເບີກຮອບໃໝ່ບໍ່ໄດ້. ບ່ອນນີ້ລ້າງນຳ.
    await client.query("update tb_used_spare set reg_start=null where product_code=$1 and reg_finish is null", [code]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("deleteSpareRequest failed", error);
    return { error: "ລົບບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }
  await logChange("ods_tb_install", code, `ລຶບໃບຂໍເບີກ ${docNo}`);
  revalidateAll();
  return { ok: `ລົບເລກທີຂໍເບີກ ${docNo} ສຳເລັດ` };
}

/* ── ສາງເບີກ SWC (save_dispatch_install) ──────────────────── */

/**
 * ເບີກອາໄຫຼ່ອອກຈາກສາງ — ຂຽນລົງ 2 ຖານຂໍ້ມູນ (ODS + ERP) ໃນ transaction ດຽວກັນ.
 * ຖ້າ ERP ລົ້ມ → ODS rollback ນຳ (ຄືກັບ ods ທີ່ໃຊ້ getcursor_tx/getcursor2_tx).
 */
export async function saveDispatch(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!db || !odgDb) return { error: "ບໍ່ພົບ DATABASE_URL / ODG_DATABASE_URL" };

  const docRef = String(formData.get("doc_ref") ?? "");     // ເລກ SION
  const docDate = String(formData.get("doc_date") ?? "");
  const productCode = String(formData.get("product_code") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!docRef || !docDate || !productCode) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  const docTime = new Date().toTimeString().slice(0, 5);

  const client = await db.connect();
  const odg = await odgDb.connect();
  let dispatchNo = "";
  let dispatchLines = 0;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734213)");

    const wh = await client.query<{ wh_code: string | null; shelf_code: string | null }>(
      "select wh_code,shelf_code from ic_trans where doc_no=$1 limit 1",
      [docRef],
    );
    const whCode = wh.rows[0]?.wh_code ?? "1103";
    const shelfCode = wh.rows[0]?.shelf_code ?? "110301";

    const itemCount = await client.query<{ count: string }>(
      "select count(item_code) count from ic_trans_detail where doc_no=$1",
      [docRef],
    );

    const spares = await client.query<{
      roworder: number; item_code: string; item_name: string; qty: string; unit_code: string; stock: string;
    }>(
      `select a.roworder, a.item_code, a.item_name, a.qty, a.unit_code, coalesce(st.balance_qty,0) stock
       from ic_trans_detail a
       left join ic_trans b on b.doc_no = a.doc_no
       left join get_odg_stock_balance('2099-12-31', a.item_code, b.wh_code, b.shelf_code) st on st.ic_code = a.item_code
       where a.doc_no=$1 and a.status in (0,5)`,
      [docRef],
    );
    if (spares.rowCount === 0) {
      await client.query("rollback");
      return { error: "ບໍ່ມີລາຍການສຳລັບເບີກ!" };
    }
    const inStock = spares.rows.filter((row) => Number(row.qty) <= Number(row.stock)).length;
    if (Number(itemCount.rows[0].count) !== inStock) {
      await client.query("rollback");
      return { error: "ຈຳນວນບໍ່ພຽງພໍສຳລັບເບີກອະໄຫຼ່!" };
    }

    const docNo = await nextDocNo(client, "SWC");
    dispatchNo = docNo;
    dispatchLines = spares.rows.length;
    const rowRefs = spares.rows.map((row) => row.roworder);

    await client.query(
      `insert into ic_trans(trans_flag,doc_date,doc_no,doc_ref,doc_ref_date,cust_code,product_code,issue,remark,
         wanrunty,isue_2,waranty_request,emp,w_reason,used_spare,job_type)
       select 56,$1,$2,doc_no,doc_date,cust_code,product_code,issue,$3,wanrunty,isue_2,waranty_request,emp,w_reason,used_spare,'install'
       from ic_trans where doc_no=$4`,
      [docDate, docNo, remark, docRef],
    );
    await client.query(
      `insert into ic_trans_detail(trans_flag,doc_date,doc_no,doc_ref_date,doc_ref,cust_code,product_code,item_code,
         item_name,qty,unit_code,calc_flag,user_created,status,job_type)
       select 56,$1,$2,doc_date,doc_no,cust_code,product_code,item_code,item_name,qty,unit_code,-1,$3,0,'install'
       from ic_trans_detail where roworder = any($4)`,
      [docDate, docNo, session.username, rowRefs],
    );

    for (const row of spares.rows) {
      await client.query(
        `update tb_used_spare set reg_finish=localtimestamp(0)
         where item_code=$1 and qty=$2 and product_code=$3 and reg_finish is null`,
        [row.item_code, row.qty, productCode],
      );
      await client.query("update ic_inventory set balance_qty=balance_qty-$1, wh_qty=wh_qty-$1 where code=$2", [
        row.qty, row.item_code,
      ]);
    }
    await client.query("update ic_trans_detail set status=1 where roworder = any($1)", [rowRefs]);

    const pending = await client.query<{ count: string }>(
      "select count(item_code) count from ic_trans_detail where status=0 and doc_no=$1",
      [docRef],
    );
    if (Number(pending.rows[0].count) === 0) {
      await client.query("update ods_tb_install set reg_finish=localtimestamp(0) where code=$1", [productCode]);
    }

    const head = await client.query<{ doc_no: string; doc_date: string; user_created: string | null }>(
      "select doc_no,doc_date,user_created from ic_trans where doc_no=$1",
      [docRef],
    );

    // ── ERP (odg) ──
    await odg.query("begin");
    await odg.query(
      `insert into ic_trans(trans_type,trans_flag,doc_no,doc_date,doc_ref,doc_ref_date,sale_code,doc_time,
         doc_format_code,wh_from,location_from,creator_code,branch_code,remark,side_code,department_code)
       values(3,56,$1,$2,$3,$4,$5,$6,'SWC',$7,$8,$9,'01',$10,'400','4001')`,
      [docNo, docDate, head.rows[0].doc_no, head.rows[0].doc_date, head.rows[0].user_created, docTime,
        whCode, shelfCode, session.username, remark],
    );
    for (const row of spares.rows) {
      await odg.query(
        `insert into ic_trans_detail(trans_type,trans_flag,doc_no,doc_date,doc_ref,item_code,item_name,unit_code,qty,
           wh_code,shelf_code,stand_value,divide_value,doc_date_calc,doc_time_calc,calc_flag)
         values(3,56,$1,$2,$3,$4,$5,$6,$7,$8,$9,1,1,$10,$11,-1)`,
        [docNo, docDate, docRef, row.item_code, row.item_name, row.unit_code, row.qty, whCode, shelfCode,
          docDate, docTime],
      );
      await odg.query("update ic_inventory set balance_qty=balance_qty-$1 where code=$2", [row.qty, row.item_code]);
    }
    await odg.query("commit");

    try {
      await client.query("commit");
    } catch (error) {
      // ODS ລົ້ມຫຼັງ ERP commit — ERP ຄືນບໍ່ໄດ້ແລ້ວ, ຕ້ອງແກ້ດ້ວຍມື
      await odg.query("rollback").catch(() => {});
      throw error;
    }
  } catch (error) {
    await client.query("rollback").catch(() => {});
    await odg.query("rollback").catch(() => {});
    console.error("saveDispatch failed", error);
    return { error: "ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກຂໍ້ມູນ!" };
  } finally {
    client.release();
    odg.release();
  }

  await logChange(
    "ods_tb_install",
    productCode,
    `ສາງເບີກອາໄຫຼ່ອອກ ${dispatchNo} · ${dispatchLines} ລາຍການ (ອ້າງອີງໃບຂໍເບີກ ${docRef})`,
  );

  revalidateAll();
  redirect("/installations/dispatch");
}

/* ── ຊ່າງຮັບອາໄຫຼ່ PISP (save_pick_spare) ─────────────────── */

export async function savePickSpare(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const docRef = String(formData.get("doc_ref") ?? "");   // ເລກ SWC
  const docDate = String(formData.get("doc_date") ?? "");
  const productCode = String(formData.get("product_code") ?? "");
  const remark = String(formData.get("remark") ?? "");
  if (!docRef || !docDate || !productCode) return { error: "ຂໍ້ມູນບໍ່ຄົບ" };

  const client = await db.connect();
  let pickNo = "";
  let pickLines = 0;
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(734214)");

    const lines = await client.query<{
      item_code: string; item_name: string; qty: string; unit_code: string;
      detail_row: number; spare_row: number;
    }>(
      `select a.item_code, a.item_name, a.qty, a.unit_code, a.roworder detail_row, sp.roworder spare_row
       from ic_trans_detail a
       left join tb_used_spare sp on sp.item_code=a.item_code and sp.qty=a.qty and sp.product_code=a.product_code
       where a.job_type='install' and a.doc_no=$1 and sp.reg_finish is not null and sp.pick_finish is null
       order by a.roworder asc`,
      [docRef],
    );
    if (lines.rowCount === 0) {
      await client.query("rollback");
      return { error: "ບໍ່ມີລາຍການສຳລັບຮັບ!" };
    }

    const docNo = await nextDocNo(client, "PISP");
    pickNo = docNo;
    pickLines = lines.rows.length;

    await client.query(
      `insert into ic_trans(trans_flag,doc_date,doc_no,product_code,remark,status,used_status,user_created,job_type,doc_ref)
       values(166,$1,$2,$3,$4,0,1,$5,'install',$6)`,
      [docDate, docNo, productCode, remark, session.username, docRef],
    );

    for (const line of lines.rows) {
      await client.query(
        `insert into ic_trans_detail(trans_flag,doc_date,doc_no,product_code,item_code,item_name,qty,unit_code,
           calc_flag,status,user_created,job_type,doc_ref)
         values(166,$1,$2,$3,$4,$5,$6,$7,1,0,$8,'install',$9)`,
        [docDate, docNo, productCode, line.item_code, line.item_name, line.qty, line.unit_code,
          session.username, docRef],
      );
      await client.query("update tb_used_spare set pick_finish=localtimestamp(0) where roworder=$1", [line.spare_row]);
      await client.query("update ic_trans_detail set status=1 where roworder=$1", [line.detail_row]);
    }

    const pending = await client.query<{ count: string }>(
      "select count(item_code) count from tb_used_spare where product_code=$1 and pick_finish is null",
      [productCode],
    );
    if (Number(pending.rows[0].count) === 0) {
      await client.query("update ods_tb_install set pick_finish=localtimestamp(0) where code=$1", [productCode]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("savePickSpare failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  await logChange(
    "ods_tb_install",
    productCode,
    `ຊ່າງຮັບອາໄຫຼ່ ${pickNo} · ${pickLines} ລາຍການ (ອ້າງອີງໃບເບີກ ${docRef})`,
  );

  revalidateAll();
  redirect("/installations/spare-pickup");
}

/* ── Feedback ລູກຄ້າ (ສາທາລະນະ — ບໍ່ຕ້ອງ login) ───────────── */

/**
 * ບັນທຶກແບບສອບຖາມ (save_cust_complain / save_cust_complain_new).
 *
 * BUG ໃນ ods: save_cust_complain_new ອັບເດດພຽງ complain_cust ເທົ່ານັ້ນ —
 * ບໍ່ໄດ້ stamp complain_finish ແລະ complain_status ຄືສະບັບເກົ່າ ⇒ ງານທີ່ລູກຄ້າ
 * ຕອບແບບສອບຖາມແລ້ວກໍບໍ່ເຄີຍໄປຮອດ "ລໍຖ້າປິດງານ" ຈຶ່ງປິດງານບໍ່ໄດ້ຈັກເທື່ອ.
 * ບ່ອນນີ້ແກ້ແລ້ວ: stamp ທັງ complain_finish ແລະ complain_status=1.
 */
export async function saveFeedback(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };
  const code = String(formData.get("code") ?? "");
  const comment = String(formData.get("cust_complain") ?? "");
  if (!code) return { error: "ບໍ່ພົບລະຫັດງານ" };

  const answers: { line: number; points: number }[] = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^points_(\d+)$/);
    if (!match) continue;
    const points = Number(value);
    if (!Number.isInteger(points) || points < 1 || points > 4) return { error: "ຄະແນນບໍ່ຖືກຕ້ອງ" };
    answers.push({ line: Number(match[1]), points });
  }
  if (answers.length === 0) return { error: "ກະລຸນາຕອບທຸກຂໍ້" };

  const client = await db.connect();
  try {
    await client.query("begin");
    const done = await client.query<{ count: string }>(
      "select count(product_code) count from cust_complain where product_code=$1 and topic_code='002'",
      [code],
    );
    if (Number(done.rows[0].count) !== 0) {
      await client.query("rollback");
      return { error: "ຕອບແບບສອບຖາມນີ້ແລ້ວ" };
    }
    // FIX: ods ລືມ stamp complain_finish/complain_status ໃນສະບັບໃໝ່
    await client.query(
      `update ods_tb_install set complain_status=1, complain_cust=$1, complain_finish=localtimestamp(0)
       where code=$2 and complain_finish is null`,
      [comment, code],
    );
    for (const answer of answers) {
      await client.query(
        "insert into cust_complain(product_code,topic_code,line_number,points) values($1,'002',$2,$3)",
        [code, answer.line, answer.points],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("saveFeedback failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  // ລູກຄ້າຕອບເອງ (ບໍ່ໄດ້ login) → logChange ຈະລົງຊື່ຜູ້ຂຽນເປັນ "ລະບົບ"
  const average = answers.reduce((sum, row) => sum + row.points, 0) / answers.length;
  await logChange(
    "ods_tb_install",
    code,
    `ລູກຄ້າຕອບແບບສອບຖາມ: ${average.toFixed(1)}/4${comment.trim() ? ` · ${comment.trim()}` : ""}`,
    { author: "ລູກຄ້າ" },
  );

  revalidateAll();
  redirect(`/feedback/${encodeURIComponent(code)}?done=1`);
}

/**
 * ແກ້ໄຂແບບສອບຖາມທີ່ສົ່ງແລ້ວ (ods: save_cust_complain_new — install_admin.py:1425).
 *
 * ໃນ ods ເສັ້ນທາງນີ້ຮຽກຮ້ອງ login (ພະນັກງານແກ້ໃຫ້ລູກຄ້າ) ແລະ ອັບເດດພຽງ complain_cust
 * ໂດຍ insert ຄະແນນຊ້ຳເຂົ້າໄປອີກ ⇒ ໄດ້ຄະແນນຊ້ຳສອງເທື່ອຕໍ່ຂໍ້ ຖ້າແກ້ຫຼາຍເທື່ອ.
 * ບ່ອນນີ້: update ຄະແນນເກົ່າ (ຫຼື insert ຖ້າຍັງບໍ່ມີຂໍ້ນັ້ນ) ຈຶ່ງບໍ່ຊ້ຳ
 * ແລະ ຮັກສາ complain_finish/complain_status ທີ່ saveFeedback stamp ໄວ້ (ບໍ່ລຶບ, ບໍ່ stamp ຄືນ).
 * ຖ້າແຖວນັ້ນຍັງບໍ່ມີ complain_finish (ຂໍ້ມູນເກົ່າຈາກ ods) → stamp ໃຫ້ ເພື່ອໃຫ້ປິດງານໄດ້.
 */
const feedbackEditSchema = z.object({
  code: z.string().min(1),
  cust_complain: z.string().max(2000),
});

export async function updateFeedback(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireSession();
  if (!db) return { error: "ບໍ່ພົບ DATABASE_URL" };

  const parsed = feedbackEditSchema.safeParse({
    code: formData.get("code") ?? "",
    cust_complain: String(formData.get("cust_complain") ?? ""),
  });
  if (!parsed.success) return { error: "ຂໍ້ມູນບໍ່ຖືກຕ້ອງ" };
  const { code, cust_complain: comment } = parsed.data;

  const answer = z.object({ line: z.number().int().positive(), points: z.number().int().min(1).max(4) });
  const answers: z.infer<typeof answer>[] = [];
  for (const [key, value] of formData.entries()) {
    const match = key.match(/^points_(\d+)$/);
    if (!match) continue;
    const row = answer.safeParse({ line: Number(match[1]), points: Number(value) });
    if (!row.success) return { error: "ຄະແນນບໍ່ຖືກຕ້ອງ" };
    answers.push(row.data);
  }
  if (answers.length === 0) return { error: "ກະລຸນາຕອບທຸກຂໍ້" };

  const client = await db.connect();
  try {
    await client.query("begin");
    const job = await client.query<{ code: string }>(
      "select code from ods_tb_install where code=$1 and cancel_date is null for update",
      [code],
    );
    if (!job.rows[0]) {
      await client.query("rollback");
      return { error: "ບໍ່ພົບງານນີ້" };
    }

    await client.query(
      `update ods_tb_install
       set complain_cust=$1, complain_status=1,
           complain_finish=coalesce(complain_finish, localtimestamp(0))
       where code=$2`,
      [comment, code],
    );

    for (const row of answers) {
      const updated = await client.query(
        "update cust_complain set points=$1 where product_code=$2 and topic_code='002' and line_number=$3",
        [row.points, code, row.line],
      );
      if (updated.rowCount === 0) {
        await client.query(
          "insert into cust_complain(product_code,topic_code,line_number,points) values($1,'002',$2,$3)",
          [code, row.line, row.points],
        );
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("updateFeedback failed", error);
    return { error: "ບັນທຶກບໍ່ສຳເລັດ" };
  } finally {
    client.release();
  }

  const average = answers.reduce((sum, row) => sum + row.points, 0) / answers.length;
  await logChange("ods_tb_install", code, `ແກ້ໄຂແບບສອບຖາມລູກຄ້າ: ${average.toFixed(1)}/4`);

  revalidateAll();
  revalidatePath(`/feedback/${code}`);
  return { ok: "ບັນທຶກສຳເລັດ" };
}
