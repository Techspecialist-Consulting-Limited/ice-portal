import type { ReportColumn, ReportKind } from "./report-types";

// ---------------------------------------------------------------------------
// CSV (retained for the Management executive report, which still exports CSV)
// ---------------------------------------------------------------------------

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Leading metadata lines make the exported file self-describing (title, period,
// filters, generation time) without a real report service. An empty row separates
// them from the data table so the table stays machine-readable.
export function buildCsv(
  columns: ReportColumn[],
  rows: Array<Record<string, string>>,
  metaLines: Array<[string, string]> = [],
): string {
  const header = columns.map((column) => escapeCsvCell(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key] ?? "")).join(","));
  const meta = metaLines.map(([label, value]) => `${escapeCsvCell(label)},${escapeCsvCell(value)}`);
  return [...meta, "", header, ...body].join("\n");
}

// Real download via a Blob. Throws on failure so the caller can surface an
// honest export-error state instead of a false success.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// XLSX — a real Office Open XML workbook, built in the browser with no runtime
// dependency. The worksheet is stored uncompressed inside a ZIP container, which
// Excel, LibreOffice and Google Sheets all read. Keeping it here means the report
// page can export a genuine .xlsx without shipping a large spreadsheet library.
// ---------------------------------------------------------------------------

export type XlsxReport = {
  /** Worksheet name, truncated to Excel's 31-character limit by the builder. */
  sheetName: string;
  /** Title written to A1. */
  title: string;
  /** Label/value metadata rows written under the title. */
  meta: Array<[string, string]>;
  columns: ReportColumn[];
  rows: Array<Record<string, string>>;
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Control characters are not valid in XML 1.0 and would corrupt the sheet.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function columnLetter(index: number): string {
  let letters = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function truncateSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, " ").trim() || "Report";
  return cleaned.slice(0, 31);
}

function textCell(reference: string, value: string, style: number): string {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function buildSheetXml(report: XlsxReport): string {
  const columns = report.columns;
  const lastColumn = columnLetter(Math.max(columns.length - 1, 0));
  const titleRow = 1;
  const metaStart = 2;
  const metaEnd = metaStart + report.meta.length - 1;
  const spacerRow = metaEnd + 1;
  const headerRow = spacerRow + 1;
  const firstDataRow = headerRow + 1;
  const lastDataRow = firstDataRow + report.rows.length - 1;

  const rows: string[] = [];

  rows.push(
    `<row r="${titleRow}" ht="22" customHeight="1">${textCell(`A${titleRow}`, report.title, 1)}</row>`,
  );

  report.meta.forEach(([label, value], index) => {
    const row = metaStart + index;
    rows.push(
      `<row r="${row}">${textCell(`A${row}`, label, 2)}${textCell(`B${row}`, value, 0)}</row>`,
    );
  });

  rows.push(`<row r="${spacerRow}"/>`);

  rows.push(
    `<row r="${headerRow}">${columns
      .map((column, index) => textCell(`${columnLetter(index)}${headerRow}`, column.label, 3))
      .join("")}</row>`,
  );

  report.rows.forEach((record, rowIndex) => {
    const row = firstDataRow + rowIndex;
    rows.push(
      `<row r="${row}">${columns
        .map((column, columnIndex) =>
          textCell(`${columnLetter(columnIndex)}${row}`, record[column.key] ?? "", 4),
        )
        .join("")}</row>`,
    );
  });

  // Widths are sized from the header and the widest rendered value, clamped so a
  // long free-text column cannot push the data table off screen.
  const widths = columns.map((column) => {
    const longest = report.rows.reduce(
      (max, record) => Math.max(max, (record[column.key] ?? "").length),
      column.label.length,
    );
    return Math.min(52, Math.max(12, longest + 2));
  });

  const metaMerges = report.meta
    .map((_, index) => {
      const row = metaStart + index;
      return `<mergeCell ref="B${row}:${lastColumn}${row}"/>`;
    })
    .join("");

  const dimension = `A1:${lastColumn}${Math.max(lastDataRow, headerRow)}`;

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    `<dimension ref="${dimension}"/>`,
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${firstDataRow}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`,
    '<sheetFormatPr defaultRowHeight="15"/>',
    `<cols>${columns
      .map(
        (_, index) =>
          `<col min="${index + 1}" max="${index + 1}" width="${widths[index]}" customWidth="1"/>`,
      )
      .join("")}</cols>`,
    `<sheetData>${rows.join("")}</sheetData>`,
    `<autoFilter ref="A${headerRow}:${lastColumn}${headerRow}"/>`,
    metaMerges ? `<mergeCells count="${report.meta.length}">${metaMerges}</mergeCells>` : "",
    "</worksheet>",
  ].join("");
}

const STYLES_XML = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<fonts count="4">',
  '<font><sz val="11"/><name val="Calibri"/><color rgb="FF1F2D27"/></font>',
  '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>',
  '<font><b/><sz val="14"/><name val="Calibri"/><color rgb="FF18251E"/></font>',
  '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF18251E"/></font>',
  "</fonts>",
  '<fills count="3">',
  '<fill><patternFill patternType="none"/></fill>',
  '<fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FF087443"/><bgColor indexed="64"/></patternFill></fill>',
  "</fills>",
  '<borders count="2">',
  "<border><left/><right/><top/><bottom/><diagonal/></border>",
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFDDE8E1"/></bottom><diagonal/></border>',
  "</borders>",
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="5">',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>',
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>',
  "</cellXfs>",
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
  "</styleSheet>",
].join("");

function buildWorkbookXml(sheetName: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>`,
    "</workbook>",
  ].join("");
}

// --- Minimal ZIP (store-only) writer ---------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: (((date.getFullYear() - 1980) & 0x7f) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function zipStore(files: Array<{ name: string; data: Uint8Array }>, stamp: Date): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(stamp);
  const entries = files.map((file) => {
    const name = encoder.encode(file.name);
    return { ...file, name, crc: crc32(file.data) };
  });

  const localSize = entries.reduce((total, entry) => total + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = entries.reduce((total, entry) => total + 46 + entry.name.length, 0);
  const totalSize = localSize + centralSize + 22;
  const output = new Uint8Array(totalSize);
  const view = new DataView(output.buffer);
  let offset = 0;

  const writeU16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const writeU32 = (value: number) => {
    view.setUint32(offset, value >>> 0, true);
    offset += 4;
  };
  const writeBytes = (bytes: Uint8Array) => {
    output.set(bytes, offset);
    offset += bytes.length;
  };

  const localOffsets: number[] = [];

  for (const entry of entries) {
    localOffsets.push(offset);
    writeU32(0x04034b50); // local file header
    writeU16(20); // version needed
    writeU16(0x0800); // UTF-8 file name flag
    writeU16(0); // stored, no compression
    writeU16(time);
    writeU16(date);
    writeU32(entry.crc);
    writeU32(entry.data.length);
    writeU32(entry.data.length);
    writeU16(entry.name.length);
    writeU16(0); // extra field length
    writeBytes(entry.name);
    writeBytes(entry.data);
  }

  const centralStart = offset;

  entries.forEach((entry, index) => {
    writeU32(0x02014b50); // central directory header
    writeU16(20); // version made by
    writeU16(20); // version needed
    writeU16(0x0800);
    writeU16(0);
    writeU16(time);
    writeU16(date);
    writeU32(entry.crc);
    writeU32(entry.data.length);
    writeU32(entry.data.length);
    writeU16(entry.name.length);
    writeU16(0); // extra
    writeU16(0); // comment
    writeU16(0); // disk number
    writeU16(0); // internal attributes
    writeU32(0); // external attributes
    writeU32(localOffsets[index]);
    writeBytes(entry.name);
  });

  // Capture the directory size before the EOCD writes advance `offset`, otherwise
  // the recorded size includes the EOCD header itself and readers report missing
  // bytes at the end of the archive.
  const centralDirectorySize = offset - centralStart;

  writeU32(0x06054b50); // end of central directory
  writeU16(0);
  writeU16(0);
  writeU16(entries.length);
  writeU16(entries.length);
  writeU32(centralDirectorySize);
  writeU32(centralStart);
  writeU16(0);

  return output;
}

export function buildXlsxWorkbook(report: XlsxReport, generatedAt = new Date()): Uint8Array {
  const sheetName = truncateSheetName(report.sheetName);
  const iso = generatedAt.toISOString();
  const encoder = new TextEncoder();
  const file = (name: string, content: string) => ({ name, data: encoder.encode(content) });

  const contentTypes = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    "</Types>",
  ].join("");

  const rootRels = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
    "</Relationships>",
  ].join("");

  const workbookRels = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    "</Relationships>",
  ].join("");

  const coreXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    `<dc:title>${escapeXml(report.title)}</dc:title>`,
    "<dc:creator>ICE 2.0</dc:creator>",
    "<cp:lastModifiedBy>ICE 2.0</cp:lastModifiedBy>",
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>`,
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>`,
    "</cp:coreProperties>",
  ].join("");

  const appXml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    "<Application>ICE 2.0</Application>",
    "</Properties>",
  ].join("");

  return zipStore(
    [
      file("[Content_Types].xml", contentTypes),
      file("_rels/.rels", rootRels),
      file("xl/workbook.xml", buildWorkbookXml(sheetName)),
      file("xl/_rels/workbook.xml.rels", workbookRels),
      file("xl/styles.xml", STYLES_XML),
      file("xl/worksheets/sheet1.xml", buildSheetXml(report)),
      file("docProps/core.xml", coreXml),
      file("docProps/app.xml", appXml),
    ],
    generatedAt,
  );
}

// Real .xlsx download. The Uint8Array is copied into a fresh ArrayBuffer so the
// Blob part type is exact in every browser.
export function downloadXlsx(filename: string, bytes: Uint8Array): void {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

const FILENAME_LABELS: Record<ReportKind, string> = {
  alert: "Alerts_Advisories",
  incident: "Incidents",
  escalation: "Escalations",
};

export function xlsxFilename(kind: ReportKind, generatedAt: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${generatedAt.getFullYear()}-${pad(generatedAt.getMonth() + 1)}-${pad(generatedAt.getDate())}`;
  return `ICE_${FILENAME_LABELS[kind]}_${stamp}.xlsx`;
}
