/**
 * ── "ກິດຈະກຳນີ້ເປັນຂອງຂ້ອຍບໍ" — ນິຍາມບ່ອນດຽວ ──
 *
 * ກິດຈະກຳມອບໃຫ້ **ຫຼາຍຄົນ** ໄດ້ (ods_activity_person) ແຕ່ຍັງເກັບຄົນທຳອິດໄວ້ທີ່
 * `ods_activity.assigned_to` ຄືເກົ່າ ⇒ ທຸກບ່ອນທີ່ຖາມວ່າ "ຂອງຂ້ອຍບໍ" ຕ້ອງເບິ່ງ
 * **ທັງສອງບ່ອນ**. ຂຽນເງື່ອນໄຂດ້ວຍມືຢູ່ແຕ່ລະ query = ມີບ່ອນລືມແນ່ນອນ ແລ້ວຄົນທີ 2
 * ຈະບໍ່ເຫັນກິດຈະກຳຂອງຕົນຢ່າງງຽບໆ.
 *
 * @param placeholder `$1` … ຂອງ query ນັ້ນ
 * @param alias ຊື່ຫຍໍ້ຂອງ ods_activity ໃນ query (ຫວ່າງ = ບໍ່ມີ alias)
 */
export function assignedToMe(placeholder: string, alias = ""): string {
  const table = alias ? `${alias}.` : "";
  return `(${table}assigned_to = ${placeholder}
    or exists (select 1 from ods_activity_person x
                where x.activity_id = ${table}id and x.username = ${placeholder}))`;
}

/** ຊື່ຜູ້ຮັບຜິດຊອບທັງໝົດຂອງກິດຈະກຳ (ຄັ່ນດ້ວຍ , ) — ໃຊ້ໃນ select */
export const ASSIGNEES_SQL = (alias = "a") =>
  `coalesce((select string_agg(x.username, ', ' order by x.username)
              from ods_activity_person x where x.activity_id = ${alias}.id), ${alias}.assigned_to)`;
