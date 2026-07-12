import { Pool, type QueryResultRow } from "pg";

/**
 * ຖານຂໍ້ມູນທີ 3: pp_od_manage — ods ໃຊ້ຜ່ານ getcursor6() (ods/dbconn6.py)
 * ມີແຕ່ໜ້າ "ຂໍສ້າງລະຫັດອາໄຫຼ່" (ods/newspare.py → ods_spare_draft) ທີ່ໃຊ້.
 *
 * ບັນຫາທີ່ພົບ: PP_DATABASE_URL ບໍ່ໄດ້ຖືກຕັ້ງໄວ້ຈັກບ່ອນ ⇒ ໜ້າ /spare-parts/new ຂຶ້ນແຕ່ກ່ອງແດງ
 * ແລະ ປຸ່ມ "ເພີ່ມລາຍການ" ບໍ່ເຮັດວຽກ ⇒ ສາຍງານ "ຂໍສ້າງລະຫັດອາໄຫຼ່" ຕາຍທັງເສັ້ນ.
 *
 * ods/dbconn6.py ໃຊ້ host/user/password ອັນດຽວກັນກັບຖານ ODS ຕ່າງແຕ່ຊື່ຖານ (pp_od_manage)
 * ⇒ ຖ້າບໍ່ໄດ້ຕັ້ງ PP_DATABASE_URL ໃຫ້ອະນຸມານເອົາຈາກ DATABASE_URL ແບບດຽວກັນ (ພິສູດແລ້ວວ່າຕໍ່ຕິດ).
 * ຢາກໃຫ້ຊີ້ໄປຄົນລະເຄື່ອງ ຄ່ອຍຕັ້ງ PP_DATABASE_URL ທັບ.
 */
declare global {
  var ppPool: Pool | undefined;
}

const PP_DATABASE = "pp_od_manage";

/** ຖານ pp_od_manage ຢູ່ເຄື່ອງດຽວກັນກັບຖານ ODS — ປ່ຽນແຕ່ຊື່ຖານ (ຄື ods/dbconn6.py) */
function derivedFromOds(): string | null {
  const ods = process.env.DATABASE_URL;
  if (!ods) return null;
  try {
    const url = new URL(ods);
    url.pathname = `/${PP_DATABASE}`;
    return url.toString();
  } catch {
    return null;
  }
}

const ppConnectionString = process.env.PP_DATABASE_URL || derivedFromOds();

export const ppDb = ppConnectionString
  ? (global.ppPool ??= new Pool({ connectionString: ppConnectionString, max: 10, connectionTimeoutMillis: 5000 }))
  : null;

export const PP_NOT_CONFIGURED = "ບໍ່ໄດ້ຕັ້ງຄ່າຖານຂໍ້ມູນ";

export async function queryPp<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  if (!ppDb) throw new Error(PP_NOT_CONFIGURED);
  return ppDb.query<T>(sql, params);
}
