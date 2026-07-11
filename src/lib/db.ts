import { Pool, type QueryResultRow } from "pg";
declare global { var odsPool: Pool | undefined; }
declare global { var odgPool: Pool | undefined; }
const connectionString = process.env.DATABASE_URL;
const odgConnectionString = process.env.ODG_DATABASE_URL;
export const db = connectionString ? (global.odsPool ??= new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 })) : null;
export const odgDb = odgConnectionString ? (global.odgPool ??= new Pool({ connectionString: odgConnectionString, max: 10, connectionTimeoutMillis: 5000 })) : null;
export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db.query<T>(sql, params);
}
export async function queryOdg<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  if (!odgDb) throw new Error("ODG_DATABASE_URL is not configured");
  return odgDb.query<T>(sql, params);
}
