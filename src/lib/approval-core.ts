import { clearCancelRequest } from "@/app/actions/service";
import { logChange } from "@/lib/chatter-log";
import { ROLE_WAREHOUSE } from "@/lib/chatter";
import { query } from "@/lib/db";
import { LINE_STATUS, TRANS } from "@/lib/stock-constants";

/**
 * **ແກ່ນ (core) ຂອງການອະນຸມັດ** — SQL ຂອງເອກະສານທີ່ເປັນເງິນຢູ່**ບ່ອນດຽວ**.
 *
 * ── ເປັນຫຍັງແຍກອອກມາ ──
 * ການອະນຸມັດເຮັດໄດ້ 2 ທາງ: ຟອມຢູ່ເວັບ (actions/approval.ts) ແລະ ແອັບ (/api/mobile/approvals).
 * ຖ້າສອງທາງຂຽນ SQL ຂອງຕົນເອງ ມື້ໜຶ່ງຈະຫຼົ້ນກັນ (ອະນຸມັດເອກະສານເງິນຜິດເງື່ອນໄຂ).
 * ⇒ ທັງສອງເອີ້ນ core ນີ້: ຮັບ **username** (ບໍ່ແມ່ນ session) ເພາະຄຳສັ່ງຈາກແອັບມາດ້ວຍ
 * Bearer token ບໍ່ມີ cookie. core **ບໍ່** redirect / revalidate — ຜູ້ເອີ້ນຈັດການເອງ.
 *
 * ⚠️ ການກວດ **ສິດ** ຢູ່ຊັ້ນຜູ້ເອີ້ນ (web: requireRole · mobile: requireMobile APPROVER_SIDE).
 * core ຖືວ່າ **ຜ່ານສິດແລ້ວ** — ຢ່າເອີ້ນ core ໂດຍບໍ່ກວດສິດກ່ອນ.
 */

export type ApproveResult = { ok: true } | { ok: false; error: string };

const fmt = (value: string | number | null) => {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
};

export type QuoteMoney = {
  product_code: string | null;
  user_created: string | null;
  total_value: string;
  total_discount: string;
  total_amount: string;
  exchange_rate: string | null;
  total_amount_2: string | null;
};

export const MONEY_SQL = `select product_code, user_created,
    coalesce(total_value,0)::text total_value, coalesce(total_discount,0)::text total_discount,
    coalesce(total_amount,0)::text total_amount, exchange_rate::text, total_amount_2::text
  from ic_trans where doc_no=$1 and trans_flag=17 limit 1`;

/** ຂໍ້ຄວາມເງິນມາດຕະຖານ — ຍອດສຸດທ້າຍ (ຫຼັງສ່ວນຫຼຸດ) + ຍອດກີບ ⇒ ຕົວເລກດຽວກັນທຸກບ່ອນ */
export function moneyLine(m: QuoteMoney | undefined) {
  if (!m) return "";
  const discount = Number(m.total_discount);
  const kip = Number(m.total_amount_2 ?? 0);
  return (
    ` · ຍອດ ${fmt(m.total_amount)} ບາດ` +
    (discount > 0 ? ` (ລວມ ${fmt(m.total_value)} − ສ່ວນຫຼຸດ ${fmt(discount)})` : "") +
    (kip > 0 ? ` ≈ ${fmt(kip)} ກີບ` : "")
  );
}

/* ── ອະນຸມັດພາຍໃນ ໃບສະເໜີລາຄາ (ຊັ້ນ 1) ── */

/** ອະນຸມັດໃບສະເໜີລາຄາ (aprove_status 0 → 1). username = ຜູ້ອະນຸມັດ (ໃສ່ author ຂອງ log) */
export async function approveQuoteCore(username: string, docNo: string, remark = ""): Promise<ApproveResult> {
  if (!docNo) return { ok: false, error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };

  const approved = await query<{ product_code: string | null; user_created: string | null }>(
    `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtime(0), approve_at=localtimestamp(0), aprove_status=1
     where doc_no=$3 and trans_flag=17 and coalesce(aprove_status,0)=0 and coalesce(aprove_status_2,0)=0
     returning product_code, user_created`,
    [remark, username, docNo],
  );
  if (!approved.rowCount) return { ok: false, error: "ໃບສະເໜີລາຄານີ້ຖືກດຳເນີນການໄປແລ້ວ" };

  const productCode = approved.rows[0]?.product_code ?? "";
  const owner = (approved.rows[0]?.user_created ?? "").trim();
  if (productCode) {
    const amounts = (await query<QuoteMoney>(MONEY_SQL, [docNo])).rows[0];
    await logChange(
      "tb_product",
      productCode,
      `ອະນຸມັດໃບສະເໜີລາຄາ ${docNo} (ພາຍໃນ)${moneyLine(amounts)}${remark.trim() ? ` · ${remark.trim()}` : ""} — ລໍຖ້າລູກຄ້າຕອບ`,
      { author: username, users: owner ? [owner] : [] },
    );
  }
  return { ok: true };
}

/** ບໍ່ອະນຸມັດໃບສະເໜີລາຄາ (0 → 2) — **ຕ້ອງມີເຫດຜົນ**. ວຽກກັບຄິວ "ລໍຖ້າສະເໜີລາຄາ" */
export async function rejectQuoteCore(username: string, docNo: string, remark: string): Promise<ApproveResult> {
  if (!docNo) return { ok: false, error: "ບໍ່ພົບເລກທີໃບສະເໜີລາຄາ" };
  if (!remark.trim()) return { ok: false, error: "ກະລຸນາລະບຸເຫດຜົນທີ່ບໍ່ອະນຸມັດ" };

  // ໜຶ່ງ UPDATE ຄຸມທັງເງື່ອນໄຂ ⇒ ບໍ່ຕ້ອງ transaction (ບໍ່ມີການແກ້ຫຼາຍຕາຕະລາງທີ່ຕ້ອງ atomic)
  const rejected = await query<{ product_code: string | null; user_created: string | null }>(
    `update ic_trans set remark_2=$1, approver1=$2, aprove_date1=localtime(0), approve_at=localtimestamp(0), aprove_status=2
     where doc_no=$3 and trans_flag=17 and coalesce(aprove_status,0)=0 and coalesce(aprove_status_2,0)=0
     returning product_code, user_created`,
    [remark.trim(), username, docNo],
  );
  if (!rejected.rowCount) return { ok: false, error: "ໃບສະເໜີລາຄານີ້ຖືກດຳເນີນການໄປແລ້ວ" };

  const productCode = rejected.rows[0].product_code ?? "";
  const owner = (rejected.rows[0].user_created ?? "").trim();
  if (productCode) {
    await query("update tb_product set qt_start=null, qt_finish=null where code=$1", [productCode]);
    await logChange(
      "tb_product",
      productCode,
      `ບໍ່ອະນຸມັດໃບສະເໜີລາຄາ ${docNo} (ພາຍໃນ) · ເຫດຜົນ: ${remark.trim()} — ໃຫ້ແກ້ໄຂແລ້ວສົ່ງອະນຸມັດຄືນ ຫຼື ລຶບແລ້ວອອກໃບໃໝ່`,
      { author: username, users: owner ? [owner] : [] },
    );
  }
  return { ok: true };
}

/* ── ອະນຸມັດ / ບໍ່ອະນຸມັດ ການຍົກເລີກໃບຮັບເຄື່ອງ ── */

/** ອະນຸມັດການຍົກເລີກ (status 6 · cancel_start ມີ · cancel_finish ວ່າງ) — ບໍ່ຍ້າຍສະຕັອກເອງ.
 *  `outstanding` = ຈຳນວນລາຍການອາໄຫຼ່ທີ່ຍັງຄ້າງນອກສາງ (ຜູ້ເອີ້ນໃຊ້ຕັດສິນວ່າຈະໄປໜ້າລາຍລະອຽດບໍ) */
export async function approveCancellationCore(
  username: string,
  productCode: string,
): Promise<{ ok: true; outstanding: number } | { ok: false; error: string }> {
  if (!productCode) return { ok: false, error: "ບໍ່ພົບລະຫັດເຄື່ອງ" };

  const done = await query(
    `update tb_product set cancel_finish=localtimestamp(0), approve_cancel=$1
     where code=$2 and status=6 and cancel_start is not null and cancel_finish is null`,
    [username, productCode],
  );
  if (!done.rowCount) return { ok: false, error: "ຄຳຂໍນີ້ຖືກດຳເນີນການໄປແລ້ວ ຫຼື ບໍ່ໄດ້ຢູ່ຂັ້ນຂໍຍົກເລີກ" };

  await logChange("tb_product", productCode, "ອະນຸມັດການຍົກເລີກໃບຮັບເຄື່ອງ", { author: username });

  // ເຕືອນສາງ ຖ້າມີອາໄຫຼ່ທີ່ເບີກອອກໄປແລ້ວຄ້າງນອກສາງ (ບໍ່ຍ້າຍສະຕັອກເອງ — ຫ້າມເຄື່ອນໄຫວແບບງຽບ)
  const spares = (
    await query<{ lines: number; units: number }>(
      `select count(*)::int lines, coalesce(sum(d.qty),0)::float units
       from ic_trans t join ic_trans_detail d on d.doc_no = t.doc_no
       where t.trans_flag=$1 and t.product_code=$2 and d.status=$3`,
      [TRANS.DISPATCH, productCode, LINE_STATUS.PENDING],
    )
  ).rows[0];
  const outstanding = spares?.lines ?? 0;
  if (outstanding > 0) {
    await logChange(
      "tb_product",
      productCode,
      `ເຕືອນ: ຍັງມີອາໄຫຼ່ທີ່ເບີກອອກຈາກສາງແລ້ວ ${outstanding} ລາຍການ (${spares?.units ?? 0} ໜ່ວຍ) ຍັງບໍ່ໄດ້ສົ່ງຄືນສາງ — ຕ້ອງສ້າງໃບຂໍສົ່ງອາໄຫຼ່ຄືນ`,
      { author: username, roles: ROLE_WAREHOUSE },
    );
  }
  return { ok: true, outstanding };
}

/** ບໍ່ອະນຸມັດການຍົກເລີກ — ວຽກກັບເຂົ້າສາຍງານປົກກະຕິ (ໃຊ້ clearCancelRequest ທີ່ກັນເງື່ອນໄຂຢູ່ SQL) */
export async function rejectCancellationCore(username: string, productCode: string, reason: string): Promise<ApproveResult> {
  if (!productCode) return { ok: false, error: "ບໍ່ພົບລະຫັດເຄື່ອງ" };
  if (!reason.trim()) return { ok: false, error: "ກະລຸນາລະບຸເຫດຜົນທີ່ບໍ່ອະນຸມັດການຍົກເລີກ" };

  const cleared = await clearCancelRequest(productCode);
  if (!cleared.ok) return { ok: false, error: cleared.error ?? "ບໍ່ອະນຸມັດການຍົກເລີກບໍ່ສຳເລັດ" };

  const previous = cleared.reason ? ` · ຄຳຂໍເດີມ: ${cleared.reason}` : "";
  await logChange(
    "tb_product",
    productCode,
    `ບໍ່ອະນຸມັດການຍົກເລີກ · ເຫດຜົນ: ${reason.trim()}${previous} — ວຽກກັບຄືນສູ່ຂັ້ນຕອນປົກກະຕິ`,
    { author: username, users: cleared.requester ? [cleared.requester] : [] },
  );
  return { ok: true };
}
