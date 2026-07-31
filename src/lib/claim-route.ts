import { query } from "@/lib/db";

/**
 * **ດ່ານກັນປົນ ສ້ອມ ↔ ເຄມ** — ບ່ອນດຽວຂອງທັງລະບົບ.
 *
 * ເຄມມີ route ຂອງຕົນຄົບແລ້ວ (/claims/jobs/…) ແຕ່ຖ້າ route ຝັ່ງສ້ອມຍັງເປີດໃບເຄມໄດ້
 * ⇒ ຍັງມີ **2 ທາງເຂົ້າ** ຫາໃບດຽວກັນ ແລະ ຄົນຈະຫຼົງກັບໄປໂລກສ້ອມຜ່ານລິ້ງເກົ່າ/bookmark.
 * ທຸກໜ້າຂອງສ້ອມທີ່ຮັບ `code` ຈຶ່ງເອີ້ນ `claimGuard()` ຂ້າງເທິງສຸດ:
 *   ໃບເປັນເຄມ  ⇒ redirect ໄປໜ້າຄູ່ຂອງມັນຝັ່ງເຄມ
 *   ໃບເປັນສ້ອມ ⇒ ຜ່ານ (ບໍ່ເຮັດຫຍັງ)
 * ແລະ ໜ້າຝັ່ງເຄມກໍ່ກວດຄືນວ່າ **ຕ້ອງເປັນເຄມແທ້** (notFound ຖ້າບໍ່ແມ່ນ).
 */
export type ClaimRouteKind = "detail" | "edit" | "print" | "check" | "return";

const CLAIM_PATH: Record<ClaimRouteKind, (code: string) => string> = {
  detail: (code) => `/claims/jobs/detail/${encodeURIComponent(code)}`,
  edit: (code) => `/claims/jobs/edit/${encodeURIComponent(code)}`,
  print: (code) => `/claims/jobs/print/${encodeURIComponent(code)}`,
  check: (code) => `/claims/jobs/check/${encodeURIComponent(code)}`,
  return: (code) => `/claims/jobs/return/${encodeURIComponent(code)}`,
};

/** ໃບນີ້ເປັນງານເຄມບໍ — ອ່ານບໍ່ໄດ້ ⇒ ຖືວ່າບໍ່ແມ່ນ (ຢ່າຂວາງໜ້າສ້ອມຍ້ອນຖານລົ້ມ) */
export async function isClaimJob(code: string): Promise<boolean> {
  try {
    const rows = await query<{ claim: boolean }>(
      "select coalesce(job_kind,'repair')='claim' as claim from tb_product where code = $1 limit 1",
      [code],
    );
    return rows.rows[0]?.claim ?? false;
  } catch (error) {
    console.error("isClaimJob failed", error);
    return false;
  }
}

/** ເສັ້ນທາງຝັ່ງເຄມທີ່ຄູ່ກັບໜ້ານີ້ — null ຖ້າໃບບໍ່ແມ່ນເຄມ */
export async function claimRedirectTarget(code: string, kind: ClaimRouteKind): Promise<string | null> {
  return (await isClaimJob(code)) ? CLAIM_PATH[kind](code) : null;
}
