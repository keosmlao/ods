import { queryOdg } from "@/lib/db";

/**
 * ── ເອກະສານທີ່ **ໝາຍເຫດ (remark) ຂອງບິນຄ່າຕິດຕັ້ງ ອ້າງເຖິງ** ──
 *
 * ບິນຄ່າຕິດຕັ້ງທີ່ຮ້ານອອກແຍກໃບ (CAKSV… · INKSV… · CAHSV…) **ບໍ່ມີແຖວສິນຄ້າ** ຢູ່ໃນຕົນເອງ
 * — ມີແຕ່ແຖວບໍລິການ 9701xx ⇒ ຄິວ "ບິນຄ້າງອອກໃບງານ" ຂຶ້ນ "ບໍ່ພົບສິນຄ້າທີ່ຕິດຕັ້ງໄດ້"
 * ແລະ ຟອມເປີດງານ **ຫາລາຍການໃຫ້ຕິກບໍ່ໄດ້ເລີຍ**. ຂໍ້ມູນຢູ່ໃສ? ຢູ່ໃນ `remark` ທີ່ CS ຂຽນ
 * ເລກເອກະສານຕົ້ນທາງໄວ້ໃຫ້ ເຊັ່ນ:
 *
 *   CAKSV26000282 → "…ໂຄງການ ເອື້ອຍຕານອ້ຍ ບ້ານໂຊກໃຫຍ່ **CAK26010017**"  (ບິນຂາຍ · 44)
 *   CAKSV26000283 → "ຄ່າບໍລິການຕິດຕັ້ງແອ+ຖອດແອ… **ບິນເບີກ WEOK260002**" (ໃບເບີກ · 56)
 *
 * ⇒ 2 ຮູບແບບ **ກົນໄກດຽວກັນ**: ອ່ານເລກເອກະສານຈາກ remark ແລ້ວໄປດຶງສິນຄ້າຈາກເອກະສານນັ້ນ.
 * ຕ່າງກັນແຕ່ `trans_flag` ຂອງເອກະສານປາຍທາງ ⇒ ຄືນ `ref_flag` ມາໃຫ້ຜູ້ເອີ້ນເລືອກທາງເອງ:
 *   **44** = ບິນຂາຍເຄື່ອງ (ມີລູກຄ້າ · ມີ ISN ຂອງບິນ)
 *   **56** = ໃບເບີກສາງ (ບໍ່ມີລູກຄ້າ ⇒ ຂໍ້ມູນລູກຄ້າຕ້ອງເອົາຈາກບິນຄ່າຕິດຕັ້ງ)
 *
 * ⚠️ ຢ່າຮັບເອກະສານ flag ອື່ນ: ໝາຍເຫດຂຽນເລກຫຍັງກໍ່ໄດ້ (ໃບຮັບເງິນ · ໃບຂໍເບີກ 122 ·
 * ເລກໂທລະສັບບາງເທື່ອກໍ່ຕົງ pattern) ⇒ ຮັບແຕ່ 2 ປະເພດທີ່ຮູ້ວ່າ**ມີແຖວສິນຄ້າຈິງ**.
 */
export type BillRemarkRef = {
  /** ບິນຄ່າຕິດຕັ້ງ (trans_flag 44) ທີ່ຂຽນອ້າງໄວ້ໃນ remark */
  doc_no: string;
  /** ເລກເອກະສານທີ່ຖືກອ້າງ */
  ref_doc: string;
  /** 44 = ບິນຂາຍເຄື່ອງ · 56 = ໃບເບີກສາງ */
  ref_flag: 44 | 56;
};

/**
 * ຮູບແບບເລກເອກະສານ ERP: ຕົວອັກສອນ 2-6 ຕົວ + ເລກ ≥6 ຕົວ
 * (CAK26010017 · WEOK260002 · IOK26070004 · INHCE26000472)
 */
const REF_PATTERN = "[A-Z]{2,6}[0-9]{6,}";

/** ແຖວບໍລິການຕິດຕັ້ງ — ນິຍາມດຽວກັບ api/installations/bills ແລະ lib/pending-bills */
const INSTALL_SERVICE_ITEM = "(sv.item_code like '9701%' or sv.item_code like '970102%')";

/**
 * `regexp_matches(…, 'g')` = ເອົາ **ທຸກເລກ**ໃນໝາຍເຫດ ບໍ່ແມ່ນແຕ່ອັນທຳອິດ.
 * ເຫດຜົນ: CAKSV26000275 ຂຽນ "…ຈາກໃບເບີກ IOK26070004  ຈາກບິນຂາຍ CAK26009339"
 * ⇒ ຖ້າເອົາແຕ່ອັນທຳອິດຈະໄດ້ໃບເບີກທີ່ມີແຕ່ທໍ່ (ຕິດຕັ້ງບໍ່ໄດ້) ແລ້ວຖິ້ມບິນຂາຍທີ່ຖືກຖິ້ມໄປ.
 * ຮຽງ `ref_flag` ຂຶ້ນກ່ອນ ⇒ ບິນຂາຍ (44) ມາກ່ອນໃບເບີກ (56) ສະເໝີ.
 */
function refsSql(matchClause: string, extra = "", limit = "") {
  return `with refs as (
      select t.doc_no,
         (regexp_matches(upper(t.remark), '(${REF_PATTERN})', 'g'))[1] as ref_doc
        from ic_trans t
       where t.trans_flag = 44
         and upper(t.remark) ~ '${REF_PATTERN}'
         and ${matchClause}
         ${extra}
    )
    select distinct r.doc_no, r.ref_doc, x.trans_flag::int as ref_flag
      from refs r
      join ic_trans x on x.doc_no = r.ref_doc and x.trans_flag in (44, 56)
     where r.ref_doc <> r.doc_no
     order by r.doc_no, ref_flag, r.ref_doc
     ${limit}`;
}

/** ເອກະສານທີ່ບິນໃນລາຍການນີ້ອ້າງໄວ້ (ໃຊ້ຕອນຮູ້ເລກບິນເຕັມແລ້ວ — ຄິວບິນຄ້າງ) */
export async function billRemarkRefs(docNos: string[]): Promise<BillRemarkRef[]> {
  if (docNos.length === 0) return [];
  const rows = await queryOdg<BillRemarkRef>(refsSql("t.doc_no = any($1::text[])"), [docNos]);
  return rows.rows;
}

/**
 * ຄືກັນ ແຕ່ຄົ້ນດ້ວຍ **ຫົວເລກບິນ** (ຄຳຄົ້ນຂອງຟອມເປີດງານອາດເປັນເລກບໍ່ເຕັມ).
 * ຮຽກຮ້ອງໃຫ້ບິນນັ້ນມີແຖວບໍລິການຕິດຕັ້ງແທ້ — ບໍ່ດັ່ງນັ້ນຈະໄປດຶງເອກະສານທີ່ບິນທົ່ວໄປອ້າງເຖິງ.
 */
export async function billRemarkRefsByPrefix(prefix: string, limit = 10): Promise<BillRemarkRef[]> {
  const rows = await queryOdg<BillRemarkRef>(
    refsSql(
      "t.doc_no like upper($1) || '%'",
      `and exists (select 1 from ic_trans_detail sv
                    where sv.doc_no = t.doc_no and sv.trans_flag = 44 and ${INSTALL_SERVICE_ITEM})`,
      `limit ${Number(limit) || 10}`,
    ),
    [prefix],
  );
  return rows.rows;
}
