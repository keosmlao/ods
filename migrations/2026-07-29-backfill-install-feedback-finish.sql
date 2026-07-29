-- ຄຳຕອບປະເມີນບາງງານຖືກ insert ແລ້ວ ແຕ່ ods ເກົ່າບໍ່ stamp complain_finish.
-- ຜົນ: ລູກຄ້າເຫັນ “ຕອບແລ້ວ” ແຕ່ job ຍັງຄ້າງຢູ່ “ລໍປະເມີນ”.
update ods_tb_install a
   set complain_status = 1,
       complain_finish = coalesce(
         (select max(c.create_date_time_now)
            from cust_complain c
           where c.product_code = a.code and c.topic_code = '002'),
         localtimestamp(0)
       )
 where a.complain_finish is null
   and a.finish_install is not null
   and a.qc_finish is not null
   and a.cancel_date is null
   and exists (
     select 1
       from cust_complain c
      where c.product_code = a.code and c.topic_code = '002'
   );
