import { Pool, type QueryResultRow } from "pg";

/**
 * ຖານຂໍ້ມູນທີ 3: pp_od_manage — ods ໃຊ້ຜ່ານ getcursor6() (ods/dbconn6.py)
 * ມີແຕ່ໜ້າ "ຂໍສ້າງລະຫັດອາໄຫຼ່" (ods/newspare.py) ທີ່ໃຊ້.
 * ຖ້າບໍ່ໄດ້ຕັ້ງ PP_DATABASE_URL ໃຫ້ຄືນ null — ໜ້າຈະສະແດງຂໍ້ຄວາມແທນການ crash.
 */
declare global {
  var ppPool: Pool | undefined;
}

const ppConnectionString = process.env.PP_DATABASE_URL;

export const ppDb = ppConnectionString
  ? (global.ppPool ??= new Pool({ connectionString: ppConnectionString, max: 10, connectionTimeoutMillis: 5000 }))
  : null;

export const PP_NOT_CONFIGURED = "ບໍ່ໄດ້ຕັ້ງຄ່າຖານຂໍ້ມູນ";

export async function queryPp<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  if (!ppDb) throw new Error(PP_NOT_CONFIGURED);
  return ppDb.query<T>(sql, params);
}
