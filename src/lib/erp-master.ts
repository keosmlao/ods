import { queryOdg } from "@/lib/db";
import { ERP_IDENTITY_SQL } from "@/lib/erp-auth";

/**
 * ຂໍ້ມູນຫຼັກທີ່ດຶງມາຈາກ ERP ໂດຍກົງ (ບໍ່ copy ມາເກັບໃນ ODS).
 * tb_type ຂອງ ODS ບໍ່ໄດ້ໃຊ້ແລ້ວ — ປະເພດສິນຄ້າຄື ic_category ຂອງ ERP.
 */

export type ErpCategory = { code: string; name_1: string };

/** ໝວດສິນຄ້າ ຈາກ ERP — ເອົາສະເພາະໝວດທີ່ມີສິນຄ້າໃຊ້ຈິງ */
export async function getErpCategories(): Promise<ErpCategory[]> {
  const result = await queryOdg<ErpCategory>(
    `select distinct c.code, c.name_1
     from ic_category c
     join ic_inventory i on i.item_category = c.code
     where coalesce(c.code,'') <> '' and coalesce(c.name_1,'') <> ''
     order by c.name_1`,
  );
  return result.rows;
}

export type ErpTechnician = { code: string; name_1: string; department: string };

/**
 * ຊ່າງ — ພະນັກງານ ຝ່າຍບໍລິການ (division 400) ຈາກ ERP odg_employee.
 * ປະກອບດ້ວຍ: 401 ພະແນກສ້ອມແປງ · 402 ພະແນກຕິດຕັ້ງ · 403 ພະແນກຕິດຕັ້ງໂຄງການ · 405 ພະແນກ CS
 *
 * ເກັບ "ຊື່ຫຼິ້ນ" ລົງ tb_product.emp_code ຄືກັບຮູບແບບຂໍ້ມູນເດີມ (ວຽກເກົ່າເກັບຊື່ສັ້ນ
 * ເຊັ່ນ Mee, Phuang) ຈຶ່ງບໍ່ຕ້ອງແກ້ໜ້າສະແດງຜົນຫຼາຍສິບໜ້າ.
 * ບາງຄົນ nickname ເປັນຂໍ້ມູນຂີ້ເຫຍື້ອ ('0') → ຕົກໄປໃຊ້ຊື່ເຕັມແທນ.
 */
export async function getErpTechnicians(): Promise<ErpTechnician[]> {
  const result = await queryOdg<ErpTechnician>(
    `select
       ${ERP_IDENTITY_SQL} as code,
       e.employee_code || ' · ' || coalesce(nullif(e.nickname,''), e.fullname_lo)
         || ' · ' || e.fullname_lo
         || ' (' || coalesce(d.department_name_lo,'-') || ')' as name_1,
       coalesce(d.department_name_lo,'') as department
     from odg_employee e
     left join odg_department d on d.department_code = e.department_code
     where e.division_code = '400' and e.employment_status = 'ACTIVE'
       and coalesce(e.fullname_lo,'') <> ''
     order by d.department_name_lo, e.fullname_lo`,
  );
  return result.rows;
}

export type ErpBrand = { code: string; name_1: string };

/**
 * ຫຍີ່ຫໍ້ ຈາກ ERP (ic_brand — 733 ຫຍີ່ຫໍ້).
 * ເອົາສະເພາະຫຍີ່ຫໍ້ທີ່ມີສິນຄ້າໃຊ້ຈິງ, ບວກກັບຫຍີ່ຫໍ້ທີ່ສິນຄ້າອ້າງແຕ່ບໍ່ມີໃນ ic_brand
 * (ມີ 17 ອັນ) ຈຶ່ງບໍ່ຕົກຫຼົ່ນ. tb_brand ຂອງ ODS ບໍ່ໄດ້ໃຊ້ແລ້ວ.
 */
export async function getErpBrands(): Promise<ErpBrand[]> {
  const result = await queryOdg<ErpBrand>(
    `select code, name_1 from (
       select b.code, coalesce(nullif(b.name_1,''), b.code) name_1
       from ic_brand b
       join ic_inventory i on i.item_brand = b.code
       union
       select distinct i.item_brand, i.item_brand
       from ic_inventory i
       where coalesce(i.item_brand,'') <> ''
         and not exists (select 1 from ic_brand b where b.code = i.item_brand)
     ) x
     order by name_1`,
  );
  return result.rows;
}
