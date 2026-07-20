-- CLM-C ຕາມ spec: ວິທีชำระ (สด/โอน/สินค้าแทน/ส่วนลด) + notified time
alter table ods_claim add column if not exists pay_method varchar(20);   -- cash|transfer|replace|discount
alter table ods_claim add column if not exists notified_at timestamp;
