import { query, queryOdg } from "@/lib/db";
import { TRANS } from "@/lib/stock-constants";

/**
 * ຜູ້ຊ່ວຍ AI (heuristic) — ແນະນຳອາໄຫຼ່ໃຫ້ຊ່າງຕອນກວດເຊັກ.
 *
 * ອີງຈາກ **ອາໄຫຼ່ທີ່ເບີກຈິງ** (ic_trans_detail flag DISPATCH=56 · ຢູ່ ODS) ໃນວຽກ
 * **ຮຸ່ນເຄື່ອງດຽວກັນ** — ບໍ່ໃຊ້ tb_used_spare (ເລີກແລ້ວ). ຊື່/ຄົງເຫຼືອ ດຶງ ic_inventory (ERP).
 */
export type SpareSuggestion = {
  code: string;
  name: string;
  unit_code: string | null;
  balance: number;
  uses: number;
  confidence: number; // 0–100 ທຽບກັບອັນທີ່ໃຊ້ຫຼາຍສຸດ
};

export async function suggestSpares(jobCode: string): Promise<SpareSuggestion[]> {
  // ຮຸ່ນເຄື່ອງຂອງງານນີ້
  const model = (
    await query<{ p_model: string | null }>(`select p_model from tb_product where code = $1`, [jobCode])
  ).rows[0]?.p_model;
  if (!model) return [];

  // ອາໄຫຼ່ທີ່ **ເບີກຈິງ** ໃນວຽກຮຸ່ນດຽວກັນ — ນັບຕາມຈຳນວນວຽກ (distinct product_code)
  const hist = (
    await query<{ code: string; uses: number }>(
      `select d.item_code as code, count(distinct d.product_code)::int as uses
         from ic_trans_detail d
         join tb_product p on p.code = d.product_code
        where d.trans_flag = $1 and d.item_code is not null
          and p.p_model = $2 and d.product_code <> $3
        group by d.item_code
        order by uses desc
        limit 5`,
      [TRANS.DISPATCH, model, jobCode],
    )
  ).rows;
  if (hist.length === 0) return [];

  const codes = hist.map((h) => h.code);
  const top = hist[0].uses || 1;

  // ຊື່ + ຄົງເຫຼືອ ຈາກ ic_inventory (ERP) — authoritative
  const master = new Map<string, { name: string; unit_code: string | null; balance: number }>();
  try {
    const inv = (
      await queryOdg<{ code: string; name_1: string | null; unit_code: string | null; balance_qty: number }>(
        `select code, name_1, unit_standard as unit_code, coalesce(balance_qty,0)::int as balance_qty
           from ic_inventory where code = any($1::varchar[])`,
        [codes],
      )
    ).rows;
    for (const r of inv) {
      master.set(r.code, { name: r.name_1 ?? r.code, unit_code: r.unit_code, balance: r.balance_qty });
    }
  } catch (error) {
    // ERP ລົ້ມ ⇒ ຄືນປະຫວັດລ້ວນ (ບໍ່ມີຄົງເຫຼືອ) ດີກວ່າລົ້ມທັງໝົດ
    console.error("suggestSpares: ic_inventory lookup failed", error);
  }

  return hist.map((h) => {
    const m = master.get(h.code);
    return {
      code: h.code,
      name: m?.name ?? h.code,
      unit_code: m?.unit_code ?? null,
      balance: m?.balance ?? 0,
      uses: h.uses,
      confidence: Math.round((h.uses / top) * 100),
    };
  });
}
