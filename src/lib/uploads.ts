import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve as resolvePath } from "node:path";
import os from "node:os";
import type { PoolClient } from "pg";

/**
 * ອັບໂຫລດຮູບເຂົ້າ product_image — ຂອງກາງ ໃຊ້ຮ່ວມກັນລະຫວ່າງ:
 *   - ໃບຮັບເຄື່ອງ (tb_product)      → key = "iteme_code"
 *   - ຄຳແຈ້ງສ້ອມ (tb_product_notice) → key = "ref_code" (ຄືກັບ ods ເກົ່າ ແລະ /cppro_online)
 *
 * ແຕ່ກ່ອນ collectUploads/saveUploads ເປັນ private ຂອງ actions/service.ts — ຍົກຂຶ້ນເປັນ
 * ຂອງກາງ ຈຶ່ງບໍ່ຕ້ອງຂຽນ logic ອັບໂຫລດ (ກວດຊະນິດ · ຈຳກັດ 16MB · ນັບ line ຕໍ່) ຊ້ຳ.
 */

const configuredUploadsDir = process.env.ODS_UPLOADS_DIR;

/**
 * ໂຟນເດີ upload — **ຂຽນ ແລະ ອ່ານ ຕ້ອງເປັນບ່ອນດຽວກັນ**.
 *
 * ⚠️ ບົດຮຽນ (04-08-2026): ແຕ່ກ່ອນ ບ່ອນຂຽນ (ໄຟລ໌ນີ້) ຫຼົບໄປ `<project>/var/uploads`
 * ອັດຕະໂນມັດເມື່ອ ODS_UPLOADS_DIR ຢູ່ນອກໂປຣເຈັກ/ນອກ home (ກັນ EPERM ຕອນ dev ເທິງ Windows)
 * ແຕ່ບ່ອນອ່ານ (/api/uploads) ອ່ານ ODS_UPLOADS_DIR ກົງໆ ⇒ ເທິງ server (uploads ຢູ່ /var/www...)
 * ຮູບຂຽນລົງບ່ອນໜຶ່ງ ອ່ານອີກບ່ອນໜຶ່ງ ⇒ ແຖວມີໃນຖານ ແຕ່ຮູບ 404.
 *
 * ດັ່ງນັ້ນ: fallback ໃຊ້**ສະເພາະ Windows** (ບ່ອນທີ່ EPERM ເກີດຈິງ) ແລະ ຝັ່ງອ່ານໃຫ້ໄລ່ຫາ
 * ທຸກບ່ອນທີ່ເຄີຍຂຽນ (uploadsReadDirs) ⇒ ຮູບເກົ່າທີ່ຕົກຄ້າງຢູ່ var/uploads ຍັງເປີດໄດ້.
 */
function resolveUploadsDirs(): { write: string | null; read: string[] } {
  if (!configuredUploadsDir) return { write: null, read: [] };
  const projectRoot = resolvePath(/*turbopackIgnore: true*/ process.cwd());
  const configured = resolvePath(configuredUploadsDir);
  const local = resolvePath(projectRoot, "var", "uploads");

  const inSafeArea = configured.startsWith(projectRoot) || configured.startsWith(resolvePath(os.homedir()));
  const write = process.platform === "win32" && !inSafeArea ? local : configured;
  // ອ່ານ: ບ່ອນຂຽນປັດຈຸບັນກ່ອນ ແລ້ວຄ່ອຍໄລ່ບ່ອນເກົ່າ (ບໍ່ຊ້ຳກັນ)
  return { write, read: [...new Set([write, configured, local])] };
}

const { write: uploadsDir, read: uploadsReadDirs } = resolveUploadsDirs();

/** ບ່ອນຂຽນໄຟລ໌ upload — ໃຫ້ທຸກທີ່ໃຊ້ຄ່ານີ້ ຢ່າອ່ານ process.env ເອງ (ບໍ່ດັ່ງນັ້ນຈະຂຽນຄົນລະບ່ອນ) */
export const UPLOADS_DIR = uploadsDir;

/** ຜົນກວດ "ຂຽນໄດ້ບໍ" — ກວດເທື່ອດຽວຕໍ່ process (undefined = ຍັງບໍ່ໄດ້ກວດ) */
let writableDir: string | null | undefined;

/**
 * ໂຟນເດີທີ່ **ຂຽນໄດ້ຈິງ** — ສ້າງໃຫ້ຖ້າຍັງບໍ່ມີ; ຖ້າ ODS_UPLOADS_DIR ໃຊ້ບໍ່ໄດ້
 * (ຕັ້ງຄ່າຜິດ · ບໍ່ມີສິດ · ອ່ານຢ່າງດຽວ) ⇒ **ຫຼົບໄປ `<project>/var/uploads`** ພ້ອມ log ດັງໆ.
 *
 * ⚠️ ບົດຮຽນ (04-08-2026): server ຕັ້ງ ODS_UPLOADS_DIR ເປັນ path ຂອງເຄື່ອງ Mac
 * (`/Users/...`) ⇒ `mkdir` ໄດ້ EACCES ⇒ **ຮັບເຄື່ອງບໍ່ໄດ້ທັງລະບົບ** (Create service failed).
 * ການອັບໂຫລດຮູບຫ້າມພາໃຫ້ "ຮັບເຄື່ອງ" ລົ້ມ ⇒ ຂຽນລົງບ່ອນສຳຮອງໄວ້ກ່ອນ.
 * ປອດໄພກວ່າແຕ່ກ່ອນ ເພາະ readUpload() ໄລ່ຫາທັງສອງບ່ອນແລ້ວ ⇒ ຮູບບໍ່ 404 ຄືເກົ່າ.
 * (ແກ້ env ໃຫ້ຖືກຍັງເປັນສິ່ງທີ່ຄວນເຮັດ — log ຈະບອກທຸກຄັ້ງ)
 */
async function ensureWritableDir(): Promise<string | null> {
  if (writableDir !== undefined) return writableDir;
  if (!uploadsDir) return (writableDir = null);
  try {
    await mkdir(/*turbopackIgnore: true*/ uploadsDir, { recursive: true });
    writableDir = uploadsDir;
  } catch (error) {
    const local = resolvePath(/*turbopackIgnore: true*/ process.cwd(), "var", "uploads");
    console.error(
      `⚠️ ODS_UPLOADS_DIR ຂຽນບໍ່ໄດ້ (${uploadsDir}) — ຂຽນລົງ ${local} ແທນ; ກະລຸນາແກ້ຄ່າໃນ .env.local`,
      error,
    );
    await mkdir(/*turbopackIgnore: true*/ local, { recursive: true });
    writableDir = local;
  }
  return writableDir;
}

/** ບ່ອນຂຽນທີ່ໃຊ້ໄດ້ຈິງ — ໃຫ້ຝັ່ງທີ່ຂຽນໄຟລ໌ເອງ (purchase · return) ເອີ້ນອັນນີ້ */
export const uploadsWriteDir = ensureWritableDir;

/**
 * ອ່ານໄຟລ໌ upload — ໄລ່ຫາທຸກໂຟນເດີທີ່ລະບົບເຄີຍຂຽນ, ບໍ່ພົບຄືນ null.
 * ຕັດ path traversal ດ້ວຍ basename() ໃນຕົວ (ຊື່ໄຟລ໌ອາດມາຈາກ URL).
 */
export async function readUpload(name: string): Promise<Buffer | null> {
  const file = basename(name);
  if (!file || file === "." || file === "..") return null;
  for (const dir of uploadsReadDirs) {
    try {
      return await readFile(join(/*turbopackIgnore: true*/ dir, file));
    } catch {
      // ບໍ່ມີໃນໂຟນເດີນີ້ — ລອງບ່ອນຕໍ່ໄປ
    }
  }
  return null;
}
const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
/** ວິດີໂອ — ໃຊ້ຮ່ວມຕາຕະລາງ product_image ໂດຍບໍ່ແກ້ schema, ແຍກຊະນິດດ້ວຍ **ນາມສະກຸນ** */
const ALLOWED_VIDEO = new Set([".mp4", ".webm", ".mov", ".m4v", ".3gp"]);
const MAX_BYTES = 16 * 1024 * 1024; // ຮູບ — ຄືກັບ MAX_CONTENT_LENGTH ຂອງ Flask
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // ວິດີໂອ 100MB/ອັນ (ຂອບເຂດລວມ submit ຢູ່ next.config bodySizeLimit)

/**
 * SQL guard: `product_url` ບໍ່ແມ່ນວິດີໂອ. ໃຊ້ໃນ query ທີ່ດຶງ "ຮູບໜ້າປົກ" ອັນດຽວ
 * (pr-view) ເພື່ອບໍ່ໃຫ້ວິດີໂອຖືກເລືອກມາໃສ່ບ່ອນທີ່ຄາດຫວັງຮູບ. ຝັງ SQL ໄດ້ (ຄ່າຄົງທີ່).
 */
export const NOT_VIDEO_SQL = "lower(product_url) !~ '\\.(mp4|webm|mov|m4v|3gp)$'";

/** ໄຟລ໌ນີ້ແມ່ນວິດີໂອບໍ (ຕັດສິນຕາມນາມສະກຸນ) — ໃຊ້ຝັ່ງ render ເລືອກ <video>/<img> */
export function isVideoUrl(url: string): boolean {
  const dot = url.lastIndexOf(".");
  return dot >= 0 && ALLOWED_VIDEO.has(url.slice(dot).toLowerCase());
}

/** ຄໍລຳທີ່ product_image ໃຊ້ຜູກຮູບ — ໃບຮັບເຄື່ອງ ຫຼື ຄຳແຈ້ງ */
export type ImageKey = "iteme_code" | "ref_code";

/** ຄື secure_filename() ຂອງ Werkzeug */
function secureFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-120);
  return cleaned || "image";
}

export type Upload = { line: number; filename: string; bytes: Buffer };

/**
 * ອ່ານຮູບອອກຈາກຟອມ — ບໍ່ຈຳກັດຈຳນວນ.
 * ods ຈຳກັດ 4 ຮູບ (file1..file4) ແຕ່ຕາຕະລາງ product_image ບໍ່ມີຂໍ້ຈຳກັດເລີຍ
 * (line_number ເປັນ smallint ທຳມະດາ; ຂໍ້ມູນຈິງມີວຽກທີ່ມີ 9 ຮູບຢູ່ແລ້ວ).
 * ຮັບທັງ field ໃໝ່ "photos" ແລະ file1..file4 ຂອງເກົ່າ ເພື່ອບໍ່ໃຫ້ຟອມເກົ່າພັງ.
 *
 * line ທີ່ຄືນມາເປັນລຳດັບຂອງຮູບໃນຄັ້ງນີ້ (0,1,2...) — saveUploads ຈະບວກ offset ໃຫ້ເອງ.
 */
export async function collectUploads(
  formData: FormData,
): Promise<{ ok: true; uploads: Upload[] } | { ok: false; error: string }> {
  const files = [
    ...formData.getAll("photos"),
    ...["file1", "file2", "file3", "file4"].map((key) => formData.get(key)),
  ].filter((file): file is File => file instanceof File && file.size > 0);

  const uploads: Upload[] = [];
  for (const [index, file] of files.entries()) {
    if (!uploadsDir) return { ok: false, error: "ບໍ່ໄດ້ຕັ້ງຄ່າ ODS_UPLOADS_DIR — ອັບໂຫລດບໍ່ໄດ້" };
    const filename = secureFilename(file.name);
    const ext = extname(filename).toLowerCase();
    const isVideo = ALLOWED_VIDEO.has(ext);
    if (!isVideo && !ALLOWED.has(ext)) return { ok: false, error: `ໄຟລ໌ທີ ${index + 1} ບໍ່ແມ່ນຮູບ ຫຼື ວິດີໂອ` };
    if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_BYTES)) {
      return { ok: false, error: `${isVideo ? "ວິດີໂອ" : "ຮູບ"}ທີ ${index + 1} ໃຫຍ່ເກີນ ${isVideo ? "100MB" : "16MB"}` };
    }
    uploads.push({ line: index, filename, bytes: Buffer.from(await file.arrayBuffer()) });
  }
  return { ok: true, uploads };
}

/**
 * ຂຽນໄຟລ໌ລົງ ODS_UPLOADS_DIR ແລ້ວ insert product_image.
 * ນັບ line_number ຕໍ່ຈາກຮູບທີ່ມີຢູ່ແລ້ວສະເໝີ ຈຶ່ງເພີ່ມຮູບໃສ່ບັນທຶກເກົ່າໄດ້ໂດຍບໍ່ທັບກັນ.
 * ເກັບ path ໄວ້ໃນ written ເພື່ອລຶບຖິ້ມຖ້າ transaction rollback.
 *
 * key = ຄໍລຳທີ່ຜູກຮູບ ("iteme_code" ໃບຮັບເຄື່ອງ · "ref_code" ຄຳແຈ້ງ) — ຄ່າຄົງທີ່,
 * ບໍ່ໄດ້ມາຈາກ user ⇒ ຝັງໃນ SQL ໄດ້ຢ່າງປອດໄພ.
 */
export async function saveUploads(
  client: PoolClient,
  code: string,
  uploads: Upload[],
  written: string[],
  key: ImageKey = "iteme_code",
) {
  if (!uploads.length) return;
  const dir = await ensureWritableDir();
  if (!dir) return;

  const next = await client.query<{ line: number }>(
    `select coalesce(max(line_number), -1) + 1 as line from product_image where ${key} = $1`,
    [code],
  );
  const offset = next.rows[0]?.line ?? 0;

  for (const { line, filename, bytes } of uploads) {
    const lineNumber = offset + line;
    const stored = `${code}_${lineNumber}_${filename}`;
    const path = join(/*turbopackIgnore: true*/ dir, stored);
    await writeFile(path, bytes);
    written.push(path);
    await client.query(`insert into product_image(${key}, product_url, line_number) values($1,$2,$3)`, [
      code,
      stored,
      lineNumber,
    ]);
  }
}
