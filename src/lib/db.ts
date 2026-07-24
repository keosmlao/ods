import { Pool, type QueryResultRow } from "pg";
declare global {
  var odsPool: Pool | undefined;
}
declare global {
  var odgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
const odgConnectionString = process.env.ODG_DATABASE_URL;

/**
 * ── ໂໝດ "database ດຽວ ແຍກ schema" (ທາງເລືອກ, backward compatible) ──
 *
 * ເດີມ: 2 database ແຍกกัน — odservice (DATABASE_URL) + odg/ERP (ODG_DATABASE_URL).
 * ໃໝ່ (ຖ້າຕັ້ງ env): ໃຊ້ odg **database ດຽວ** ແຕ່ ODS ຢູ່ **schema `ods`**, ERP ຢູ່ `public`.
 *   → ຕັ້ງ DATABASE_URL = ODG_DATABASE_URL = (odg), ODS_SCHEMA=ods, ODG_SCHEMA=public
 *   → join ຂ້າມ schema ໃນ query ດຽວໄດ້ (ໃສ່ຊື່ qualify ເຊັ່ນ public.ic_inventory), backup ບ່ອນດຽວ.
 *
 * `search_path` ຕັ້ງຕໍ່ pool ⇒ SQL ເກົ່າບໍ່ຕ້ອງແກ້ (ຊື່ຕາຕະລາງ resolve ຕາມ search_path).
 * ບໍ່ຕັ້ງ ODS_SCHEMA/ODG_SCHEMA = ພຶດຕິກຳເກົ່າ (2 database) ບໍ່ປ່ຽນເລີຍ.
 */
const odsSchema = process.env.ODS_SCHEMA?.trim();
const odgSchema = process.env.ODG_SCHEMA?.trim();

// libpq: `-c search_path=<schema>` — ຮັບຄ່າ comma-separated ໄດ້ (ເຊັ່ນ "ods,public")
const schemaConfig = (schema?: string) => (schema ? { options: `-c search_path=${schema}` } : {});

export const db = connectionString
  ? (global.odsPool ??= new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 5000,
      ...schemaConfig(odsSchema),
    }))
  : null;
export const odgDb = odgConnectionString
  ? (global.odgPool ??= new Pool({
      connectionString: odgConnectionString,
      max: 10,
      connectionTimeoutMillis: 5000,
      ...schemaConfig(odgSchema),
    }))
  : null;

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db.query<T>(sql, params);
}
export async function queryOdg<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  if (!odgDb) throw new Error("ODG_DATABASE_URL is not configured");
  return odgDb.query<T>(sql, params);
}
