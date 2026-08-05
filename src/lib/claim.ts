import {
  type BillItem,
  type ClaimBill,
  type ClaimCandidate,
  type ClaimDailySummary,
  type ClaimItem,
  type InvItem,
  type ClaimJobCandidate,
  type ClaimLog,
  type ClaimPhoto,
  type ClaimRow,
  claimStatusLabel,
  type ClaimType,
  type CobInfo,
  type JobDelivery,
} from "@/lib/claim-shared";
import { query, queryOdg } from "@/lib/db";
import { createCobForClaim } from "@/lib/erp-cob";

// ⚠️ ຄ່າຄົງ + types + pure fn ຢູ່ claim-shared (client import ໄດ້). ບ່ອນນີ້ = query functions (server).
export * from "@/lib/claim-shared";

type RawClaim = Omit<ClaimRow, "status_label" | "amount"> & { amount: string | null };

const mapRow = (r: RawClaim): ClaimRow => ({
  ...r,
  amount: Number(r.amount ?? 0),
  status_label: claimStatusLabel(r.claim_type, r.status),
});

const SELECT = `select c.id, c.claim_no, c.claim_type, c.supplier_code, c.brand_code, c.customer_code,
    cust.name_1 customer_name, c.ref_job, c.erp_doc_no, c.status, c.amount, c.reason, c.created_by,
    to_char(c.created_at,'DD-MM-YYYY HH24:MI') created_at,
    to_char(c.email_sent_at,'DD-MM-YYYY HH24:MI') email_sent_at, c.pay_method, c.remark,
    c.product, c.model, c.sn, c.warranty, to_char(c.purchase_date,'DD-MM-YYYY') purchase_date, c.contact, c.bill_no, c.resolution,
    c.fulfillment_source, c.claim_scope
  from ods_claim c
  left join ar_customer cust on cust.code = c.customer_code`;

export async function listClaims(opts: { type?: ClaimType; status?: string; q?: string } = {}): Promise<ClaimRow[]> {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.type) { args.push(opts.type); where.push(`c.claim_type = $${args.length}`); }
  if (opts.status) { args.push(opts.status); where.push(`c.status = $${args.length}`); }
  if (opts.q?.trim()) {
    args.push(`%${opts.q.trim()}%`);
    where.push(`(c.claim_no ilike $${args.length} or c.supplier_code ilike $${args.length} or c.ref_job ilike $${args.length} or cust.name_1 ilike $${args.length})`);
  }
  const sql = `${SELECT}${where.length ? ` where ${where.join(" and ")}` : ""} order by c.created_at desc nulls last, c.id desc`;
  return (await query<RawClaim>(sql, args)).rows.map(mapRow);
}

export async function claimByNo(claimNo: string): Promise<ClaimRow | null> {
  const r = (await query<RawClaim>(`${SELECT} where c.claim_no = $1 limit 1`, [claimNo])).rows[0];
  return r ? mapRow(r) : null;
}

/**
 * ໃບເຄມ **ທີ່ກ່ຽວ** — ໃບອື່ນທີ່ອ້າງ `ref_job` ດຽວກັນ (B/A/C ຂອງເລື່ອງດຽວກັນ). ຍົກເວັ້ນໃບປັດຈຸບັນ.
 * ບໍ່ມີ ref_job = ບໍ່ມີໃບກ່ຽວ (ຄืน []).
 */
export async function relatedClaims(refJob: string | null, excludeNo: string): Promise<ClaimRow[]> {
  if (!refJob?.trim()) return [];
  return (
    await query<RawClaim>(`${SELECT} where c.ref_job = $1 and c.claim_no <> $2 order by c.claim_type, c.id`, [refJob.trim(), excludeNo])
  ).rows.map(mapRow);
}

/** ຄົ້ນຮ້ານ/ລູກຄ້າ ຈາກ ar_customer — ໃຫ້ picker ຂອງໜ້າເປີດໃບເຄມ (ແທນ text ດິບ) */
export async function searchCustomers(q = "", limit = 30): Promise<{ code: string; name: string; tel: string | null }[]> {
  const term = q.trim();
  const args: (string | number)[] = [];
  const conds = ["nullif(trim(name_1),'') is not null"]; // ຂ້າມ customer ບໍ່ມີຊື່ (picker ບໍ່ໃຫ້ແຖວເປົ່າ)
  if (term) {
    args.push(`%${term}%`);
    conds.push(`(code ilike $${args.length} or name_1 ilike $${args.length} or tel ilike $${args.length})`);
  }
  const where = `where ${conds.join(" and ")}`;
  args.push(limit);
  return (
    await query<{ code: string; name: string; tel: string | null }>(
      // ⚠️ alias ຕ້ອງ quote — `name_1 name` ຊົນກັບ type `name` ຂອງ Postgres = syntax error
      `select code, name_1 as "name", tel from ar_customer ${where} order by name_1 limit $${args.length}`,
      args,
    )
  ).rows;
}

/** ຄົ້ນບິນຂາຍ ERP (ic_trans trans_flag 44) — ໂດຍເລກບິນ ຫຼື ລະຫัส/ຊື່ລູກຄ້າ. iso_date ໃຫ້ client ຄິດປะກັນ */
export async function searchBills(q = "", limit = 20): Promise<ClaimBill[]> {
  const term = q.trim();
  if (!term) return [];
  return (
    await queryOdg<ClaimBill>(
      `select t.doc_no, to_char(t.doc_date,'DD-MM-YYYY') doc_date, to_char(t.doc_date,'YYYY-MM-DD') iso_date,
          t.cust_code, c.name_1 cust_name, coalesce(t.total_amount,0)::float total
        from ic_trans t
        left join ar_customer c on c.code = t.cust_code
       where t.trans_flag = 44 and (t.doc_no ilike $1 or t.cust_code ilike $1 or c.name_1 ilike $1)
       order by t.doc_date desc limit $2`,
      [`%${term}%`, limit],
    )
  ).rows;
}

/** ລາຍการສินค้าໃນບິນ (ic_trans_detail) — ໃຫ້ເລືອກສິນຄ້າທີ່ມີບັນຫາ */
export async function billItems(docNo: string): Promise<BillItem[]> {
  if (!docNo?.trim()) return [];
  return (
    await queryOdg<BillItem>(
      `select d.item_code, d.item_name, coalesce(d.qty,0)::float qty, d.unit_code unit, i.item_brand brand
        from ic_trans_detail d left join ic_inventory i on i.code = d.item_code
       where d.doc_no = $1 and d.trans_flag = 44 order by d.line_number`,
      [docNo.trim()],
    )
  ).rows;
}

/**
 * ຮັບປະກັນວ່າ customer_code ມີໃນ ODS ar_customer — ຖ້າບໍ່ມີ (ລູກຄ້າ ERP ຈາກບິນ) → copy ຈາກ ERP.
 * ໃຫ້ join `cust.name_1` ໃນລາຍການເຄມ ໂຊ້ຊື່ໄດ້ (ບໍ່ໃຫ້ຂຶ້ນ "-").
 */
export async function ensureOdsCustomer(code: string): Promise<void> {
  const c = code.trim();
  if (!c) return;
  const has = ((await query(`select 1 from ar_customer where code = $1 limit 1`, [c])).rowCount ?? 0) > 0;
  if (has) return;
  const erp = (
    await queryOdg<{ name_1: string | null; tel: string | null; address: string | null }>(
      // ⚠️ ERP ar_customer ໃຊ້ `telephone` (ບໍ່ມີ `tel` ຄື ODS) — select tel ຈະ error
      `select name_1, coalesce(telephone,'') tel, coalesce(address,'') address from ar_customer where code = $1 limit 1`,
      [c],
    )
  ).rows[0];
  if (!erp) return; // ບໍ່ພົບໃນ ERP — ຂ້າມ (ບໍ່ block ການເປີດໃບ)
  await query(
    `insert into ar_customer(code, name_1, tel, address, ref_code, ar_type)
     values ($1, $2, $3, $4, $1, 'erp') on conflict (code) do nothing`,
    [c, erp.name_1 ?? "", erp.tel ?? "", erp.address ?? ""],
  );
}

/** ຄົ້ນສິນຄ້າ/ອາໄຫຼ່ ຈາກ ic_inventory (master) — ໃຫ້ເລືອກອາໄຫຼ່ທີ່ຕ້ອງการปเปลี่ยน */
export async function searchInventory(q = "", limit = 20): Promise<InvItem[]> {
  const term = q.trim();
  if (!term) return [];
  return (
    await queryOdg<InvItem>(
      `select code, name_1 as "name", unit_standard unit, item_brand brand from ic_inventory
        where code ilike $1 or name_1 ilike $1 order by name_1 limit $2`,
      [`%${term}%`, limit],
    )
  ).rows;
}

/**
 * ຮູບຫຼັກฐานของใบเคลม — ເກັບໃນ product_image (ref_code = claim_no, ໃຊ້ຮ່ວມ saveUploads/serving
 * ຂອງ /api/uploads). ພຽງແຕ່ຮູບ (ບໍ່ເອົາວິດີໂອ) — serve ຜ່ານ /api/uploads/{path}.
 */
export async function claimPhotos(claimNo: string): Promise<ClaimPhoto[]> {
  return (
    await query<ClaimPhoto>(
      `select line_number id, product_url path, null::text created_at from product_image
        where ref_code=$1 and lower(product_url) !~ '\\.(mp4|webm|mov|m4v|3gp)$' order by line_number`,
      [claimNo],
    )
  ).rows;
}

export async function claimItems(claimNo: string): Promise<ClaimItem[]> {
  const rows = (await query<Omit<ClaimItem, "qty" | "amount"> & { qty: string; amount: string }>(
    `select id, item_code, item_name, qty, unit, amount, note from ods_claim_item where claim_no = $1 order by id`,
    [claimNo],
  )).rows;
  return rows.map((r) => ({ ...r, qty: Number(r.qty), amount: Number(r.amount) }));
}

export async function claimLogs(claimNo: string): Promise<ClaimLog[]> {
  return (await query<ClaimLog>(
    `select to_char(at,'DD-MM-YYYY HH24:MI') at, by_user, event, detail from ods_claim_log where claim_no = $1 order by id desc`,
    [claimNo],
  )).rows;
}

/**
 * ອ່ານເອກະສານ COB (ic_trans trans_flag=87) ຈາກ ERP — **read-only** (ໃຫ້ CLM-C ຜູກ doc_no
 * ຂອງໃບ COB ທີ່ບັນຊີສ້າງໄວ້ແລ້ວ, ບໍ່ສ້າງ/ບໍ່ແກ້ ໃນ ERP). status 0 = ຍັງ, 1+ = ດຳເນີນການ.
 */
export async function cobInfo(docNo: string): Promise<CobInfo | null> {
  const r = (
    await queryOdg<{ doc_no: string; doc_date: string | null; cust_code: string | null; total_amount: string | null; status: number }>(
      // ໃບຕັ້ງໜີ້ຕ້ອງຮັບ (AOB 99) ຂອງລະບົບ — ຮັບໃບ COB (87) ເກົ່າທີ່ບັນຊີເຄີຍຜູກໄວ້ນຳ
      `select doc_no, to_char(doc_date,'DD-MM-YYYY') doc_date, cust_code, total_amount, status
         from ic_trans where trans_flag in (99, 87) and doc_no = $1 limit 1`,
      [docNo],
    )
  ).rows[0];
  return r ? { doc_no: r.doc_no, doc_date: r.doc_date, supplier_code: r.cust_code, total_amount: Number(r.total_amount ?? 0), status: r.status } : null;
}

/** ຂໍ້ມູນ "ເອກະສານສົ່ງເຄື່ອງ" (delivery) ຂອງ job — ໃຫ້ CLM-C ດຶງມາກຳນົດການເຄມ + ໃສ່ email */
export async function jobDelivery(code: string): Promise<JobDelivery | null> {
  const r = (
    await query<JobDelivery>(
      `select a.code, a.name_1 product, a.p_brand brand, a.p_model model, a.sn,
          nullif(trim(coalesce(a.issue,'')),'') fault, c.name_1 customer,
          to_char(a.return_complete,'DD-MM-YYYY') returned_at
        from tb_product a left join ar_customer c on c.code = a.cust_code where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  return r ?? null;
}

/**
 * ລາຍການ "ເອກະສານ pending" ຂອງ job = ໃບສະເໜີລາຄາ/ໃບເກັບເງິນ (ic_trans_detail trans_flag=17)
 * — ຄ່າແຮງ + ອາໄຫຼ່ + **ລາຄາຈິງ** (sum_amount). ໃຫ້ CLM-C ດຶງມາອອກໃບເຄມ.
 */
export type JobQuoteItem = { item_code: string | null; item_name: string | null; qty: number; unit: string | null; amount: number };
export async function jobQuoteItems(code: string): Promise<{ docNo: string | null; items: JobQuoteItem[] }> {
  const doc = (await query<{ doc_no: string }>(
    `select doc_no from ic_trans where trans_flag = 17 and product_code = $1 order by coalesce(aprove_status,0) desc, doc_date desc limit 1`,
    [code],
  )).rows[0]?.doc_no ?? null;
  if (!doc) return { docNo: null, items: [] };
  const rows = (await query<{ item_code: string | null; item_name: string | null; qty: string; unit: string | null; amount: string }>(
    `select item_code, item_name, coalesce(qty,0)::float8 qty, unit_code unit, coalesce(sum_amount,0)::float8 amount
       from ic_trans_detail where doc_no = $1 and trans_flag = 17 and item_code is not null order by roworder`,
    [doc],
  )).rows;
  return { docNo: doc, items: rows.map((r) => ({ ...r, qty: Number(r.qty), amount: Number(r.amount) })) };
}

/**
 * **ລາຍລະອຽດຂອງໃບງານ + ລາຍການທີ່ຈະຮຽກເກັບ** — ໃຫ້ຟອມ "ເປີດໃບເຄມ" ດຶງຕອນເລືອກງານ.
 *
 * ── ລາຍການມາຈາກໃສ ──
 * ① **ໃບສະເໜີລາຄາ/ເກັບເງິນ (17)** ຖ້າມີ — ດີທີ່ສຸດ ເພາະມີ **ລາຄາຈິງ** (ຄ່າແຮງ + ອາໄຫຼ່)
 * ② ບໍ່ມີໃບນັ້ນ ⇒ **ອາໄຫຼ່ທີ່ໃຊ້ຈິງ** (tb_used_spare) ລາຄາ 0 ໃຫ້ຄົນຕື່ມເອງ.
 *   ງານຮັບປະກັນສ່ວນຫຼາຍບໍ່ໄດ້ອອກໃບສະເໜີລາຄາ (ບໍ່ໄດ້ເກັບເງິນລູກຄ້າ) ແຕ່**ຍັງຕ້ອງເກັບ
 *   ຄ່າອາໄຫຼ່ນຳ supplier** ⇒ ຂາດຂັ້ນ ② ໄປ ຄົນຕ້ອງພິມລາຍການເອງທຸກເທື່ອ.
 */
export type ClaimJobDetail = {
  code: string;
  product: string | null;
  brand: string | null;
  model: string | null;
  sn: string | null;
  customer: string | null;
  customer_code: string | null;
  fault: string | null;
  fault_2: string | null;
  warranty: string | null;
  service_type: string | null;
  technician: string | null;
  returned_at: string | null;
  /** ເລກໃບສະເໜີລາຄາ/ເກັບເງິນ ທີ່ເອົາລາຍການມາ (null = ເອົາມາຈາກອາໄຫຼ່ທີ່ໃຊ້) */
  quote_no: string | null;
  items_from: "quote" | "spare" | null;
  items: JobQuoteItem[];
};

export async function jobClaimDetail(code: string): Promise<ClaimJobDetail | null> {
  const job = (
    await query<Omit<ClaimJobDetail, "quote_no" | "items" | "items_from">>(
      `select a.code, a.name_1 product, a.p_brand brand, a.p_model model, nullif(a.sn,'') sn,
          c.name_1 customer, a.cust_code customer_code,
          nullif(trim(coalesce(a.issue,'')),'') fault, nullif(trim(coalesce(a.issue_2,'')),'') fault_2,
          nullif(a.warrunty,'') warranty, nullif(a.service_type,'') service_type, nullif(a.emp_code,'') technician,
          to_char(a.return_complete,'DD-MM-YYYY') returned_at
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where a.code = $1 limit 1`,
      [code],
    )
  ).rows[0];
  if (!job) return null;

  const quote = await jobQuoteItems(code);
  if (quote.items.length > 0) return { ...job, quote_no: quote.docNo, items_from: "quote", items: quote.items };

  const spares = (
    await query<{ item_code: string | null; item_name: string | null; qty: string; unit: string | null }>(
      `select item_code, item_name, coalesce(qty,0)::float8 qty, unit_code unit
         from tb_used_spare where product_code = $1 and coalesce(item_code,'') <> '' order by roworder`,
      [code],
    )
  ).rows;
  return {
    ...job,
    quote_no: null,
    items_from: spares.length > 0 ? "spare" : null,
    items: spares.map((s) => ({ ...s, qty: Number(s.qty) || 1, amount: 0 })),
  };
}

/**
 * งานสอมที่ "**สำเร็จ · ส่งคืนลูกค้าแล้ว · ยังไม่มีใบเคลม**" — สำหรับ modal เลือก
 * เลขงานตอนเปิดใบเคลม. return_complete is not null (ส่งคืนแล้ว) + ยังไม่ถูกอ้างอิง
 * ในใบเคลมใดๆ (ทุกประเภท). ค้นด้วย code/สินค้า/SN/ยี่ห้อ/ลูกค้า.
 */
export async function jobClaimCandidates(q = ""): Promise<ClaimJobCandidate[]> {
  const term = `%${q.trim()}%`;
  return (
    await query<ClaimJobCandidate>(
      `select a.code, a.name_1 product, a.p_brand brand, a.p_model model, a.sn,
          nullif(trim(coalesce(a.issue,'')),'') fault, c.name_1 customer,
          to_char(a.return_complete,'DD-MM-YYYY') returned_at
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
       where a.return_complete is not null
         and a.code not in (select ref_job from ods_claim where ref_job is not null)
         and ($1 = '' or a.code ilike $2 or a.name_1 ilike $2 or a.sn ilike $2
              or a.p_brand ilike $2 or c.name_1 ilike $2)
       order by a.return_complete desc limit 100`,
      [q.trim(), term],
    )
  ).rows;
}

/**
 * **ເປີດໃບ CLM-C ຈາກໜ້າໃບຮັບເງິນ** — ໝາຍວ່າ "ບິນນີ້ໄປເກັບເງິນນຳ supplier".
 *
 * ── ເປັນຫຍັງຢູ່ຈຸດອອກໃບຮັບເງິນ ──
 * ນັ້ນຄື**ນາທີດຽວ**ທີ່ຮູ້ຄົບທຸກຢ່າງພ້ອມກັນ: ສ້ອມຫຍັງແດ່ (ລາຍການໃນບິນ) · ໃນປະກັນບໍ (ລູກຄ້າຈ່າຍ 0)
 * · ແລະ ງານ**ສົ່ງຄືນສຳເລັດ**ແລ້ວ (ເງື່ອນໄຂຂອງ CLM-C). ໃຫ້ຄົນໄປເປີດເອງພາຍຫຼັງ = ລືມ ແລ້ວ
 * ເງິນທີ່ຄວນເກັບຄືນຈາກ supplier ຫາຍໄປ.
 *
 * ລາຍການຂອງໃບເຄມ = **ລາຍການໃນບິນ** (ອາໄຫຼ່ + ຄ່າບໍລິການ) ພ້ອມລາຄາ **ຈາກການຕັ້ງຄ່າ**
 * ບໍ່ແມ່ນລາຄາ 0 ທີ່ເກັບລູກຄ້າ — ງານໃນປະກັນລູກຄ້າຈ່າຍ 0 ແຕ່ supplier ຕ້ອງຈ່າຍເຕັມ
 * (ຜູ້ເອີ້ນສົ່ງ `lines` ມາເອງ ⇒ ຕັດສິນລາຄາຢູ່ບ່ອນທີ່ຮູ້ context).
 *
 * ບໍ່ໂຍນ error: ການອອກໃບຮັບເງິນ**ຫ້າມພັງ**ເພາະໃບເຄມ — ຄືນ null ແລ້ວປ່ອຍໃຫ້ບິນສຳເລັດ.
 */
export async function openReimburseClaim(input: {
  jobCode: string;
  supplierCode: string;
  brandCode?: string | null;
  customerCode?: string | null;
  reason?: string | null;
  product?: string | null;
  model?: string | null;
  sn?: string | null;
  /** ຮັບປະກັນຂອງງານ — 'in' ໃນປະກັນ · 'out' ນອກ (ຄ່າດຽວກັບຟອມເປີດໃບເຄມ) */
  warranty?: "in" | "out" | null;
  createdBy: string;
  lines: { item_code: string | null; item_name: string | null; qty: number; unit: string | null; amount: number }[];
}): Promise<string | null> {
  try {
    if (!input.supplierCode.trim()) return null;
    // ມີໃບ CLM-C ຂອງງານນີ້ຢູ່ແລ້ວ ⇒ ບໍ່ອອກຊ້ຳ (ກົດດຽວກັບ createClaim)
    const exists = await query(`select 1 from ods_claim where claim_type='C' and ref_job=$1 limit 1`, [input.jobCode]);
    if (exists.rowCount) return null;

    const id = (
      await query<{ id: number }>(
        `insert into ods_claim(claim_type, supplier_code, brand_code, customer_code, ref_job, reason, status,
           created_by, product, model, sn, warranty)
         values ('C', $1, nullif($2,''), nullif($3,''), $4, nullif($5,''), 'notify', $6,
           nullif($7,''), nullif($8,''), nullif($9,''), nullif($10,'')) returning id`,
        [
          input.supplierCode.trim(), input.brandCode ?? "", input.customerCode ?? "", input.jobCode,
          input.reason ?? "", input.createdBy, input.product ?? "", input.model ?? "", input.sn ?? "",
          input.warranty ?? "",
        ],
      )
    ).rows[0]?.id;
    if (!id) return null;
    const claimNo = (
      await query<{ claim_no: string }>(
        `update ods_claim set claim_no = 'CLM'||lpad(id::text,5,'0') where id=$1 returning claim_no`,
        [id],
      )
    ).rows[0]?.claim_no;
    if (!claimNo) return null;

    for (const line of input.lines) {
      await query(
        `insert into ods_claim_item(claim_no, item_code, item_name, qty, unit, amount)
         values ($1, nullif($2,''), $3, $4, nullif($5,''), $6)`,
        [claimNo, line.item_code ?? "", line.item_name || "ລາຍການ", line.qty || 1, line.unit ?? "", line.amount || 0],
      );
    }
    await query(
      `update ods_claim set amount = coalesce((select sum(amount) from ods_claim_item where claim_no=$1),0) where claim_no=$1`,
      [claimNo],
    );
    // ອອກໃບເຄມ = ອອກ COB ໃຫ້ເລີຍ (ຕັດສິນໃຈ 05-08-2026)
    await ensureClaimCob(claimNo, input.createdBy);
    return claimNo;
  } catch (error) {
    console.error("openReimburseClaim failed", input.jobCode, error);
    return null;
  }
}

/**
 * **ອອກ COB ຢູ່ ERP ໃຫ້ໃບເຄມ (ຖ້າຍັງບໍ່ມີ)** ແລ້ວເກັບເລກໃສ່ `ods_claim.erp_doc_no`.
 *
 * ເອີ້ນຕອນ**ໃບເຄມມີຍອດແລ້ວ** (ສ້າງພ້ອມລາຍການ · ດຶງລາຍການຈາກງານ) — ບໍ່ແມ່ນຕອນເປົ່າ
 * ເພາະ COB ຍອດ 0 ບໍ່ມີຄວາມໝາຍທາງບັນຊີ. idempotent: ມີ erp_doc_no ແລ້ວ ⇒ ບໍ່ເຮັດຫຍັງ.
 * ບໍ່ໂຍນ error — ໃບເຄມສຳຄັນກວ່າເອກະສານບັນຊີ (ເບິ່ງ lib/erp-cob).
 */
export async function ensureClaimCob(claimNo: string, by: string): Promise<string | null> {
  try {
    const claim = await claimByNo(claimNo);
    if (!claim || claim.claim_type !== "C" || claim.erp_doc_no || !claim.supplier_code) return null;
    if (!(claim.amount > 0)) return null;
    const docNo = await createCobForClaim({
      claimNo: claim.claim_no,
      supplierCode: claim.supplier_code,
      jobCode: claim.ref_job,
      amountThb: claim.amount,
      by,
    });
    if (!docNo) return null;
    await query(`update ods_claim set erp_doc_no=$2 where claim_no=$1 and erp_doc_no is null`, [claimNo, docNo]);
    return docNo;
  } catch (error) {
    console.error("ensureClaimCob failed", claimNo, error);
    return null;
  }
}

/** ໝາຍໄວ້ວ່າ "ເຄມເງິນ supplier" ບໍ (ods_claim_mark) */
export async function isJobClaimMarked(jobCode: string): Promise<boolean> {
  return ((await query(`select 1 from ods_claim_mark where job_code = $1`, [jobCode])).rowCount ?? 0) > 0;
}

/**
 * candidate CLM-C = งานส่งคืนแล้ว + ยังไม่มี CLM-C + (ຫຍີ່ຫໍ້ຢູ່ໃນ config ods_claim_brand
 * **ຫຼື** ໝາຍເອງ ods_claim_mark). supplier ດຶງจาก brand config (prefill ตอนเปิดใบ).
 */
export async function claimCandidatesC(): Promise<ClaimCandidate[]> {
  return (
    await query<ClaimCandidate>(
      `select a.code, a.name_1 product, a.p_brand brand, c.name_1 customer,
          to_char(a.return_complete,'DD-MM-YYYY') returned_at, bc.supplier_code supplier
        from tb_product a
        left join ar_customer c on c.code = a.cust_code
        left join ods_claim_brand bc on bc.brand_code = a.p_brand and bc.active
       where a.return_complete is not null
         and (bc.brand_code is not null or a.code in (select job_code from ods_claim_mark))
         and a.code not in (select ref_job from ods_claim where claim_type = 'C' and ref_job is not null)
       order by a.return_complete desc limit 200`,
    )
  ).rows;
}

/** ສະຫຼຸບເຄມປະຈຳວັນ (ສຳລັບ cron → email/Line OA). read-only aggregates. */
export async function claimDailySummary(): Promise<ClaimDailySummary> {
  const [open, money, cand] = await Promise.all([
    // ⚠️ 'paid' = ປິດແລ້ວ ສຳລັບ C (flow C ຈົບທີ່ paid, ບໍ່ມີ closed) — ຕ້ອງນັບເປັນ ບໍ່ເປີດ
    query<{ claim_type: string; n: number }>(`select claim_type, count(*)::int n from ods_claim where status not in ('closed','rejected','paid') group by claim_type`),
    query<{ s: string | null }>(`select coalesce(sum(amount),0) s from ods_claim where claim_type='C' and status not in ('paid','closed','rejected')`),
    query<{ n: number }>(`select count(*)::int n from tb_product a join ods_claim_mark m on m.job_code=a.code
       where a.return_complete is not null and a.code not in (select ref_job from ods_claim where claim_type='C' and ref_job is not null)`),
  ]);
  const byType = Object.fromEntries(open.rows.map((r) => [r.claim_type, r.n]));
  return {
    openA: byType.A ?? 0, openB: byType.B ?? 0, openC: byType.C ?? 0,
    pendingMoney: Number(money.rows[0]?.s ?? 0),
    candidates: cand.rows[0]?.n ?? 0,
  };
}

/** ໂຕເລກຕໍ່ status (badge ໃນ pipeline) ຂອງ type ໜຶ່ງ */
export async function claimCounts(type: ClaimType): Promise<Record<string, number>> {
  const rows = (await query<{ status: string; n: number }>(
    `select status, count(*)::int n from ods_claim where claim_type = $1 group by status`,
    [type],
  )).rows;
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

/**
 * ສະຫຼຸບຍອດເງິນ/ອາຍຸຂອງເຄມຕໍ່ type — **ບໍ່ຂຶ້ນກັບ filter status/ຄົ້ນ** (ຄື claimCounts)
 * ໃຫ້ບັດ KPI ຂອງໜ້າເຄມທັງ 3 (ບໍ່ຫົດເມື່ອກົດ chip). open = ບໍ່ closed/rejected/paid.
 */
export async function claimAmountSummary(type: ClaimType): Promise<{
  openCount: number;
  openAmount: number;
  approvedAmount: number;
  /** CLM-C: ຍອດແຈ້ງແລ້ວລໍຊຳລະ / ຍອດທີ່ເກັບແລ້ວ */
  notifiedAmount: number;
  paidAmount: number;
  suppliers: number;
  oldestDays: number;
}> {
  const open = `status not in ('closed','rejected','paid')`;
  const row = (
    await query<{ open_count: number; open_amount: number; approved_amount: number; notified_amount: number; paid_amount: number; suppliers: number; oldest_days: number }>(
      `select count(*) filter (where ${open})::int open_count,
          coalesce(sum(case when ${open} then amount end),0)::float8 open_amount,
          coalesce(sum(case when status = 'approved' then amount end),0)::float8 approved_amount,
          coalesce(sum(case when status = 'notified' then amount end),0)::float8 notified_amount,
          coalesce(sum(case when status = 'paid' then amount end),0)::float8 paid_amount,
          count(distinct supplier_code) filter (where ${open})::int suppliers,
          coalesce(max(extract(epoch from (localtimestamp - created_at)) / 86400) filter (where ${open}),0)::int oldest_days
        from ods_claim where claim_type = $1`,
      [type],
    )
  ).rows[0];
  return {
    openCount: row?.open_count ?? 0,
    openAmount: row?.open_amount ?? 0,
    approvedAmount: row?.approved_amount ?? 0,
    notifiedAmount: row?.notified_amount ?? 0,
    paidAmount: row?.paid_amount ?? 0,
    suppliers: row?.suppliers ?? 0,
    oldestDays: row?.oldest_days ?? 0,
  };
}

/**
 * ນັບ CLM-B ຕໍ່ claim_scope + fulfillment_source — **ບໍ່ຂຶ້ນກັບ filter status/ຄົ້ນ** (ຍອດລວມຕໍ່ type).
 * ໃຫ້ card ສະຫຼຸບ ບໍ່ຫົດເມື່ອກົດ chip (ບໍ່ໃຊ້ rows ທີ່ filter ແລ້ວ).
 */
export async function claimScopeSummary(type: ClaimType): Promise<{ scope: Record<string, number>; fulfillment: Record<string, number> }> {
  const [scope, ful] = await Promise.all([
    query<{ k: string | null; n: number }>(`select claim_scope k, count(*)::int n from ods_claim where claim_type=$1 group by claim_scope`, [type]),
    query<{ k: string | null; n: number }>(`select fulfillment_source k, count(*)::int n from ods_claim where claim_type=$1 group by fulfillment_source`, [type]),
  ]);
  return {
    scope: Object.fromEntries(scope.rows.filter((r) => r.k).map((r) => [r.k as string, r.n])),
    fulfillment: Object.fromEntries(ful.rows.filter((r) => r.k).map((r) => [r.k as string, r.n])),
  };
}
