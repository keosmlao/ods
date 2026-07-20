import ExcelJS from "exceljs";

/* ສ້າງໄຟລ໌ .xlsx ແທນ .xls ເກົ່າ (xlwt) — ຮອງຮັບ Unicode ພາສາລາວ 100% */

export type XlsxColumn = { header: string; key: string; width?: number };

/** ຄ່າທີ່ຂຽນລົງ cell ໄດ້ */
export type CellValue = string | number | Date | null;
export type XlsxRow = Record<string, CellValue>;

/** ໜຶ່ງ sheet = ຊື່ + columns + rows */
export type XlsxSheet = { name: string; columns: XlsxColumn[]; rows: XlsxRow[] };

function addSheet(workbook: ExcelJS.Workbook, { name, columns, rows }: XlsxSheet) {
  // ຊື່ sheet ຂອງ Excel ຫ້າມເກີນ 31 ຕົວ ແລະ ຫ້າມມີ : \ / ? * [ ]
  const sheet = workbook.addWorksheet(name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Report");
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width ?? 18 }));

  const header = sheet.getRow(1);
  header.font = { name: "Phetsarath OT", bold: true };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  header.commit();

  for (const row of rows) {
    const added = sheet.addRow(row);
    added.font = { name: "Phetsarath OT" };
    added.eachCell((cell) => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      if (cell.value instanceof Date) cell.numFmt = "DD-MM-YYYY HH:mm:ss";
    });
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, columns.length) } };
}

export async function buildXlsx(sheetName: string, columns: XlsxColumn[], rows: XlsxRow[]): Promise<Buffer> {
  return buildXlsxMulti([{ name: sheetName, columns, rows }]);
}

/** ຫຼາຍ sheet ໃນໄຟລ໌ດຽວ */
export async function buildXlsxMulti(sheets: XlsxSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  if (sheets.length === 0) workbook.addWorksheet("Report");
  for (const s of sheets) addSheet(workbook, s);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function xlsxHeaders(filename: string) {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  };
}

/** ສ້າງ Response ຂອງໄຟລ໌ Excel — ໃຊ້ໃນ route handler ຂອງ /api/reports/export/* */
export async function respondXlsx(sheetName: string, columns: XlsxColumn[], rows: XlsxRow[], filename: string) {
  const body = await buildXlsx(sheetName, columns, rows);
  return new Response(new Uint8Array(body), { headers: xlsxHeaders(filename) });
}

/** Response Excel ຫຼາຍ sheet */
export async function respondXlsxMulti(sheets: XlsxSheet[], filename: string) {
  const body = await buildXlsxMulti(sheets);
  return new Response(new Uint8Array(body), { headers: xlsxHeaders(filename) });
}
