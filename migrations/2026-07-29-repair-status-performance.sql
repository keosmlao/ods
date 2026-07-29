-- ເລັ່ງ /dashboard ແລະ /dashboard/status/repair/*
--
-- STAGE_SQL ກວດຮອຍເອກະສານດ້ວຍ product_code ສຳລັບແຕ່ລະວຽກ.
-- ກ່ອນ migration ນີ້:
--   ic_trans_detail ~1.35M ແຖວ — ມີ index trans_flag/item_code/doc_no ແຕ່ບໍ່ມີ product_code
--   ic_trans        ~313K ແຖວ — ມີ index trans_flag ແຕ່ບໍ່ມີ product_code
-- ⇒ PostgreSQL ຕ້ອງ scan ຂໍ້ມູນຈຳນວນຫຼາຍຊ້ຳໆ ເມື່ອຄຳນວນຂັ້ນ,
--    ນັບແຖວ, ຈັດຮຽງຕາມອາຍຸ ແລະໂຫຼດ thumbnail.
--
-- CREATE INDEX CONCURRENTLY ບໍ່ lock ການຂຽນຂໍ້ມູນດົນໆ.
-- ໄຟລ໌ນີ້ຕ້ອງຮັນນອກ transaction (ຫ້າມ BEGIN/COMMIT).

create index concurrently if not exists idx_tb_product_code
  on tb_product (code);

create index concurrently if not exists idx_tb_product_open_stage_time
  on tb_product (return_complete, time_register)
  where return_complete is null;

create index concurrently if not exists idx_ic_trans_job_flag_date
  on ic_trans (product_code, trans_flag, doc_date desc);

create index concurrently if not exists idx_ic_trans_detail_job_flag_status
  on ic_trans_detail (product_code, trans_flag, status, roworder desc);

create index concurrently if not exists idx_product_image_job_line
  on product_image (iteme_code, line_number);

create index concurrently if not exists idx_ods_stock_count_missing_job
  on ods_stock_count (job_code)
  where found = false;

analyze tb_product;
analyze ic_trans;
analyze ic_trans_detail;
analyze product_image;
analyze ods_stock_count;
