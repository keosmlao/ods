"use server";
import { logChange } from "@/lib/chatter-log";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { APPROVER_SIDE } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * ອະນຸມັດ / ບໍ່ອະນຸມັດ **ການປ່ຽນສະຖານະການຮັບປະກັນ** (ເບິ່ງ lib/warranty-request).
 *
 * ອະນຸມັດ ⇒ ຂຽນ `warrunty` ຈິງ ແລະ ໃບຈະໄຫຼໄປ "ລໍຖ້າສະເໜີລາຄາ" ເອງ
 * (STAGE_SQL ອ່ານ warrunty — ບໍ່ຕ້ອງແຕະ status ດ້ວຍມື).
 * ບໍ່ອະນຸມັດ ⇒ ໃບຄົງເປັນ "ຮັບປະກັນ" ຄືເກົ່າ, ບໍ່ຕ້ອງຖອຍຫຍັງ ເພາະບໍ່ເຄີຍປ່ຽນ.
 */
export type WarrantyState = { ok?: string; error?: string };

async function decide(id: number, approve: boolean, note: string): Promise<WarrantyState> {
  const guard = await requireRole(APPROVER_SIDE, "ບໍ່ມີສິດອະນຸມັດ");
  if (!guard.ok) return { error: guard.error };

  const request = (
    await query<{ job_code: string; to_warranty: string; reason: string; requested_by: string }>(
      `select job_code, to_warranty, reason, requested_by
         from ods_warranty_request where id = $1 and state = 'pending'`,
      [id],
    )
  ).rows[0];
  if (!request) return { error: "ບໍ່ພົບຄຳຂໍນີ້ ຫຼື ຕັດສິນໄປແລ້ວ" };

  await query(
    `update ods_warranty_request
        set state = $1, decided_by = $2, decided_at = localtimestamp, decide_note = nullif($3,'')
      where id = $4 and state = 'pending'`,
    [approve ? "approved" : "rejected", guard.session.username, note.trim(), id],
  );

  if (approve) {
    await query(`update tb_product set warrunty = $1, warranty_reason = $2 where code = $3`, [
      request.to_warranty,
      request.reason,
      request.job_code,
    ]);
  }

  await logChange(
    "tb_product",
    request.job_code,
    approve
      ? `ອະນຸມັດປ່ຽນເປັນ "${request.to_warranty}" (ຂໍໂດຍ ${request.requested_by}) · ເຫດຜົນ: ${request.reason}`
      : `ບໍ່ອະນຸມັດການປ່ຽນເປັນ "${request.to_warranty}" — ຄົງເປັນຮັບປະກັນ${note.trim() ? ` · ${note.trim()}` : ""}`,
    { users: [request.requested_by] },
  );

  revalidatePath("/approvals/warranty");
  revalidatePath(`/service/${request.job_code}`);
  return { ok: approve ? "ອະນຸມັດແລ້ວ" : "ບໍ່ອະນຸມັດແລ້ວ" };
}

export async function approveWarranty(id: number, note = ""): Promise<WarrantyState> {
  return decide(id, true, note);
}

export async function rejectWarranty(id: number, note = ""): Promise<WarrantyState> {
  return decide(id, false, note);
}
