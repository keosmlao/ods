import type { Workflow } from "@/lib/commission";
import { addFollowerSilently, chatterSince, logChange } from "@/lib/chatter-log";
import type { Activity, ChatterMessage } from "@/lib/chatter";
import { query } from "@/lib/db";
import { notify } from "@/lib/notify";

/**
 * Chatter ແລະ ກິດຈະກຳ ສຳລັບ **ແອັບມືຖື**.
 *
 * ── ເປັນຫຍັງບໍ່ເອີ້ນ actions/chatter ຊື່ໆ ──
 * action ຝັ່ງເວັບທຸກໂຕເລີ່ມດ້ວຍ `getSession()` (cookie). ຄຳສັ່ງຈາກແອັບມາດ້ວຍ
 * **Bearer token** ບໍ່ມີ cookie ⇒ getSession() = null ⇒ ມັນຈະຄືນ [] ຢ່າງງຽບໆ
 * ແລະ ຂໍ້ຄວາມທີ່ໂພສຈະບັນທຶກບໍ່ໄດ້. ບ່ອນນີ້ຈຶ່ງຮັບ `author` ມາຊື່ໆແທນ.
 *
 * SQL ອັນດຽວກັບຝັ່ງເວັບ (actions/chatter) ⇒ ແອັບກັບເວັບເຫັນຂໍ້ມູນຊຸດດຽວກັນ.
 */

/** ຕາຕະລາງທີ່ chatter ຜູກນຳ — ຕາມສາຍງານ */
export const chatterModelOf = (workflow: Workflow) =>
  workflow === "install" ? "ods_tb_install" : "tb_product";

export type JobChatter = {
  messages: ChatterMessage[];
  activities: Activity[];
};

export async function jobChatter(workflow: Workflow, code: string): Promise<JobChatter> {
  const model = chatterModelOf(workflow);
  // ຕັດ log ຂອງໃບເກົ່າທີ່ໃຊ້ເລກ code ຊ້ຳ (ເບິ່ງ chatterSince) ⇒ ເຫັນສະເພາະໃບປັດຈຸບັນ
  const since = await chatterSince(model, code);

  const [messages, activities] = await Promise.all([
    query<ChatterMessage>(
      `select id, kind, body, author, to_char(created_at,'DD-MM-YYYY HH24:MI') created_at
         from ods_chatter_message
        where model=$1 and res_id=$2
          and ($3::timestamp is null or created_at >= $3::timestamp)
        order by id desc limit 100`,
      [model, code, since],
    ),
    query<Activity>(
      `select id, model, res_id, kind, summary, note, assigned_to,
          to_char(due_date,'DD-MM-YYYY') due_date, state, created_by,
          (due_date - current_date)::int days_left
         from ods_activity
        where model=$1 and res_id=$2 and state='planned'
          and ($3::timestamp is null or created_at >= $3::timestamp)
        order by due_date`,
      [model, code, since],
    ),
  ]);
  return { messages: messages.rows, activities: activities.rows };
}

/** ຊ່າງພິມຂໍ້ຄວາມຈາກແອັບ — ຄົນຕິດຕາມເອກະສານ (CS/ຫົວໜ້າ) ໄດ້ຮັບແຈ້ງເຕືອນຢູ່ເວັບທັນທີ */
export async function postJobMessage(
  workflow: Workflow,
  code: string,
  author: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: "ກະລຸນາພິມຂໍ້ຄວາມ" };
  const model = chatterModelOf(workflow);

  try {
    await query(
      `insert into ods_chatter_message(model, res_id, kind, body, author, created_at)
       values($1,$2,'comment',$3,$4,localtimestamp(0))`,
      [model, code, text, author],
    );
    await addFollowerSilently(model, code, author);
  } catch (error) {
    console.error("postJobMessage failed", error);
    return { ok: false, error: "ສົ່ງຂໍ້ຄວາມບໍ່ສຳເລັດ" };
  }

  // actor ຕ້ອງສົ່ງເອງ — notify() ອ່ານ session ບໍ່ໄດ້ຈາກຄຳຂໍຂອງແອັບ
  await notify(model, code, text, "comment", { actor: author });
  return { ok: true };
}

/**
 * ກົດວ່າກິດຈະກຳເຮັດແລ້ວ (ຈາກແອັບ) — ຕາຕະລາງມີແຕ່ `done_at`/`done_note`
 * (ບໍ່ມີ done_by) ແລະ ປິດໄດ້ **ສະເພາະກິດຈະກຳຂອງຕົນ** ຄືກົດເກນຝັ່ງເວັບ.
 */
export async function completeJobActivity(
  id: number,
  author: string,
  doneNote = "",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const done = await query<{ model: string; res_id: string; summary: string }>(
    `update ods_activity set state='done', done_at=localtimestamp(0), done_note=nullif($3,'')
      where id=$1 and state='planned' and assigned_to=$2
      returning model, res_id, summary`,
    [id, author, doneNote.trim()],
  );
  const row = done.rows[0];
  if (!row) return { ok: false, error: "ກິດຈະກຳນີ້ປິດໄປແລ້ວ ຫຼື ບໍ່ແມ່ນຂອງທ່ານ" };

  const suffix = doneNote.trim() ? ` — ${doneNote.trim()}` : "";
  await logChange(row.model, row.res_id, `ກິດຈະກຳສຳເລັດ: ${row.summary}${suffix}`, { author });
  return { ok: true };
}
