/**
 * ງານຕິດຕັ້ງທີ່ຍັງມີຈຳນວນອາໄຫຼ່ຄ້າງຂໍເບີກ.
 *
 * ກະຕ່າ tb_used_spare ອາດຫຼາຍກວ່າຈຳນວນໃນໃບ 122 ຮອບທຳອິດ
 * (ແບ່ງຂໍຈາກຫຼາຍສາງ). ຈຶ່ງຕ້ອງຮັກສາ Job ໄວ້ໃນຄິວຂໍເບີກ
 * ຈົນກວ່າ wanted − (122 − 59) ຈະເຫຼືອ 0.
 *
 * SQL ນີ້ຕ້ອງໃຊ້ ods_tb_install alias `a`.
 */
export const INSTALL_HAS_UNREQUESTED_SPARES = `exists (
  select 1
  from (
    select s.item_code, sum(s.qty) wanted,
      coalesce((
        select sum(case when d.trans_flag = 122 then d.qty else -d.qty end)
        from ic_trans_detail d
        where d.product_code = a.code
          and d.item_code = s.item_code
          and d.trans_flag in (122,59)
      ),0) requested
    from tb_used_spare s
    where s.product_code = a.code
    group by s.item_code
  ) outstanding
  where outstanding.wanted > outstanding.requested
)`;

/** ຄິວ actionable: ຮັບງານແລ້ວ, ຍັງບໍ່ເລີ່ມຕິດຕັ້ງ ແລະຍັງມີຈຳນວນຄ້າງ. */
export const INSTALL_SPARE_REQUEST_QUEUE = `a.cancel_date is null
  and a.job_finish is null
  and a.tech_confirm is not null
  and a.start_install is null
  and ${INSTALL_HAS_UNREQUESTED_SPARES}`;
