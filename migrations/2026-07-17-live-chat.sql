-- ═══════════════════════════════════════════════════════════════════
--  Live chat — ພະນັກງານ · ຫົວໜ້າ · ຜູ້ຈັດການ · ຊ່າງ ລົມກັນ
--  ຖານ: ODS ເທົ່ານັ້ນ · **ເພີ່ມຢ່າງດຽວ**
--
--  ── ເປັນຫຍັງບໍ່ໃຊ້ ods_chatter_message ທີ່ມີຢູ່ ──
--  ຕົວນັ້ນຜູກກັບ**ເອກະສານ** (model + res_id = ໃບຮັບເຄື່ອງ/ໃບງານ) — ທຸກຂໍ້ຄວາມແມ່ນ
--  "ຄຳເຫັນຢູ່ໃນໃບນັ້ນ". ການລົມກັນລະຫວ່າງຄົນບໍ່ມີໃບໃຫ້ຜູກ ແລະ ຕ້ອງການສິ່ງທີ່ chatter
--  ບໍ່ມີ: ຫ້ອງສົນທະນາ · ຮູ້ວ່າອ່ານຮອດໃສແລ້ວ (unread) · ບອກວ່າໃຜອອນລາຍ.
--  ⇒ ຕາຕະລາງຂອງຕົນເອງ ແຕ່**ຢືມກົນໄກເກົ່າ**: ແຈ້ງເຕືອນຜ່ານ ods_notification
--  ແລະ ດັນມືຖືຜ່ານ ods_push_token (ບໍ່ສ້າງລະບົບແຈ້ງເຕືອນຊ້ອນ).
--
--  ── ຮູບແບບຫ້ອງ ──
--  `room` ເປັນ text ຄົງທີ່:
--    'dm:<a>|<b>'  ລົມສອງຄົນ — ຊື່ຜູ້ໃຊ້ **ຮຽງ a→z ສະເໝີ** ຈຶ່ງບໍ່ມີທາງເກີດ 2 ຫ້ອງ
--                  ຂອງຄູ່ດຽວກັນ (keo→stk ແລະ stk→keo = ຫ້ອງດຽວ)
--    'team:<role>' ຫ້ອງກຸ່ມຕາມໜ້າວຽກ (technical · stock · manager …)
--    'all'         ຫ້ອງລວມທັງບໍລິສັດ
--  ບໍ່ມີຕາຕະລາງ "ຫ້ອງ" ແຍກ — ຫ້ອງເກີດເອງເມື່ອມີຂໍ້ຄວາມທຳອິດ (ບໍ່ຕ້ອງດູແລແຖວຜີ).
-- ═══════════════════════════════════════════════════════════════════

begin;

create table if not exists ods_chat_message (
  id          bigserial primary key,
  /** ຫ້ອງ: 'dm:a|b' (ຮຽງ a→z) · 'team:<role>' · 'all' */
  room        varchar(120) not null,
  /** ຜູ້ສົ່ງ (users.username) */
  author      varchar(50)  not null,
  body        varchar(2000) not null,
  created_at  timestamp not null default localtimestamp(0)
);

-- ດຶງຂໍ້ຄວາມຂອງຫ້ອງ ຮຽງໃໝ່ສຸດ + ຖາມ "ມີຫຍັງໃໝ່ຫຼັງ id ນີ້ບໍ" (polling) ⇒ index ນີ້ພຽງພໍ
create index if not exists ods_chat_message_room_id_idx on ods_chat_message (room, id desc);
create index if not exists ods_chat_message_created_idx on ods_chat_message (created_at desc);

comment on table ods_chat_message is
  'ຂໍ້ຄວາມສົນທະນາລະຫວ່າງພະນັກງານ (live chat). ຕ່າງຈາກ ods_chatter_message ທີ່ເປັນຄຳເຫັນຜູກກັບເອກະສານ. ຫ້ອງເກີດເອງຈາກ room key — ບໍ່ມີຕາຕະລາງຫ້ອງ.';

/** ອ່ານຮອດໃສແລ້ວ — 1 ແຖວຕໍ່ (ຄົນ, ຫ້ອງ). ບໍ່ມີແຖວ = ຍັງບໍ່ເຄີຍເປີດຫ້ອງນັ້ນ */
create table if not exists ods_chat_read (
  room          varchar(120) not null,
  username      varchar(50)  not null,
  last_read_id  bigint not null default 0,
  updated_at    timestamp not null default localtimestamp(0),
  primary key (room, username)
);

comment on table ods_chat_read is
  'ບຸກມາກການອ່ານ: ຂໍ້ຄວາມ id ສຸດທ້າຍທີ່ຄົນນີ້ອ່ານແລ້ວໃນຫ້ອງນີ້. ຍັງບໍ່ອ່ານ = ນັບ id ທີ່ໃຫຍ່ກວ່າ.';

commit;
