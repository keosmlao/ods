import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve as resolvePath } from "node:path";
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
 * Resolve a safe uploads directory. If `ODS_UPLOADS_DIR` points outside
 * the project root and outside the current user's home directory, fall back
 * to a project-local `var/uploads` directory to avoid attempting to create
 * or write top-level system folders (which can cause EPERM on Windows).
 */
function getSafeUploadsDir() {
  if (!configuredUploadsDir) return null;
  const projectRoot = resolvePath(/*turbopackIgnore: true*/ process.cwd());
  const home = resolvePath(os.homedir());
  const resolved = resolvePath(configuredUploadsDir);

  if (resolved.startsWith(projectRoot) || resolved.startsWith(home)) {
    return resolved;
  }

  // Fallback: project-local uploads directory
  return resolvePath(projectRoot, "var", "uploads");
}

const uploadsDir = getSafeUploadsDir();
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
  if (!uploads.length || !uploadsDir) return;
  await mkdir(uploadsDir, { recursive: true });

  const next = await client.query<{ line: number }>(
    `select coalesce(max(line_number), -1) + 1 as line from product_image where ${key} = $1`,
    [code],
  );
  const offset = next.rows[0]?.line ?? 0;

  for (const { line, filename, bytes } of uploads) {
    const lineNumber = offset + line;
    const stored = `${code}_${lineNumber}_${filename}`;
    const path = join(/*turbopackIgnore: true*/ uploadsDir, stored);
    await writeFile(path, bytes);
    written.push(path);
    await client.query(`insert into product_image(${key}, product_url, line_number) values($1,$2,$3)`, [
      code,
      stored,
      lineNumber,
    ]);
  }
}
