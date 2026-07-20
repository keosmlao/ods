-- ຜູ້ຮັບລາຍງານອັດຕະໂນມັດ (email/line) — ຈັດການໃນ UI ແທນ env. report='claim' ຕອນນີ້.
create table if not exists ods_report_recipient (
  id serial primary key,
  report varchar(20) not null default 'claim',
  channel varchar(10) not null,          -- 'email' | 'line'
  target varchar(200) not null,          -- email | line userId/groupId
  name varchar(100),
  active boolean not null default true,
  created_by varchar(50), created_at timestamp default now(),
  unique (report, channel, target)
);
