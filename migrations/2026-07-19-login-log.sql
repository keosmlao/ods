-- ── ຕິດຕາມການເຂົ້າລະບົບຂອງ user (19-07-2026) ──
-- ບັນທຶກທຸກຄັ້ງທີ່ login ສຳເລັດ (ເວັບ + ມືຖື) — ໃຫ້ຜູ້ຈັດການເບິ່ງໃຜເຂົ້າ ເມື່ອໃດ ຈາກໃສ.
-- ບໍ່ບັນທຶກລະຫັດຜ່ານ. IP/user-agent ໄວ້ກວດຄວາມຜິດປົກກະຕິ.

create table if not exists ods_login_log (
  id          bigserial primary key,
  username    varchar not null,
  source      varchar not null default 'web',   -- 'web' | 'mobile'
  ip          varchar,
  user_agent  varchar,
  logged_at   timestamp not null default localtimestamp(0)
);

create index if not exists idx_ods_login_log_time on ods_login_log (logged_at desc);
create index if not exists idx_ods_login_log_user on ods_login_log (username, logged_at desc);
