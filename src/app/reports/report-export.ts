import type { ReportColumn } from "./report-types";

export type ExportFormat = "pdf" | "excel" | "csv";

export type ExportCapability = {
  format: ExportFormat;
  label: string;
  available: boolean;
  /** Why the format is unavailable, shown to the user. */
  reason?: string;
};

// Only CSV is offered, and only because the app already exports CSV directly in
// the browser (see the Alerts & Advisories page). PDF and Excel are listed but
// marked unavailable rather than mislabelled — nothing here should pretend to
// produce a PDF or .xlsx it cannot actually build.
export const EXPORT_FORMATS: ExportCapability[] = [
  {
    format: "pdf",
    label: "PDF",
    available: false,
    reason: "PDF generation is not configured in this environment. No PDF file is produced.",
  },
  {
    format: "excel",
    label: "Excel",
    available: false,
    reason: "Excel (.xlsx) generation is not configured in this environment. No Excel file is produced.",
  },
  {
    format: "csv",
    label: "CSV",
    available: true,
  },
];

export function isExportAvailable(format: ExportFormat): boolean {
  return EXPORT_FORMATS.some((capability) => capability.format === format && capability.available);
}

function escapeCell(value: string): string {
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
  const header = columns.map((column) => escapeCell(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCell(row[column.key] ?? "")).join(","));
  const meta = metaLines.map(([label, value]) => `${escapeCell(label)},${escapeCell(value)}`);
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
