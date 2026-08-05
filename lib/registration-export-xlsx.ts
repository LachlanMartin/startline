import ExcelJS from "exceljs";
import {
  excelCellValues,
  excelHeadersFor,
  excelWidthsFor,
  formatStartListGroupTitle,
  groupByStartWave,
  type ExportColumnKey,
  type ExportRegistrationRow,
} from "@/lib/registration-export";

export async function buildRegistrationsXlsx(opts: {
  eventTitle: string;
  rows: ExportRegistrationRow[];
  columns?: ExportColumnKey[] | null;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Startline";
  workbook.created = new Date();

  const headers = excelHeadersFor(opts.columns);
  const widths = excelWidthsFor(opts.columns);

  const sheetName = opts.eventTitle.slice(0, 31) || "Registrations";
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = headers.map((header, i) => ({
    header,
    key: `c${i}`,
    width: widths[i] ?? 14,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };

  // Wave-grouped layout matching the race management UI / PDF start list.
  const groups = groupByStartWave(opts.rows);
  for (const g of groups) {
    const title = formatStartListGroupTitle(g).toUpperCase();
    const section = sheet.addRow([title]);
    sheet.mergeCells(section.number, 1, section.number, headers.length);
    section.font = { bold: true };
    section.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8E8E8" },
    };
    for (const r of g.rows) {
      sheet.addRow(excelCellValues(r, opts.columns));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
