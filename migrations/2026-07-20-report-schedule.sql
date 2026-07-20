-- ຕັ້ງເວລາ + ເລືອກ ລາຍງານອັດຕະໂນມັດ ທີ່ຈະສົ່ງ (email/line). cron ຮາຍໂມງ → ສົ່ງ report ທີ່ຮອດເວລາ.
create table if not exists ods_report_schedule (
  report_key varchar(40) primary key,
  enabled boolean not null default false,
  send_time varchar(5) not null default '08:00',   -- HH:MM (24h)
  last_sent date
);
insert into ods_report_schedule(report_key) values
  ('daily-receipts'), ('pending-status'), ('purchase-3d'), ('claim-money'), ('supplier-debt'), ('daily-installs')
on conflict (report_key) do nothing;
