import { ArrowUpRight, BellRing, ClipboardList } from "lucide-react";

// The Risk Administrator reports workspace supports exactly the three report
// types whose sources exist in the portal. Usage and contact-completion reports
// belong to other workspaces (or have no connected source) and are not exposed
// here; System Administrator audit reports never appear in this workspace.
export type ReportKind = "alert" | "incident" | "escalation";

export type ReportFilterKey =
  | "priority"
  | "status"
  | "category"
  | "audience"
  | "location"
  | "ack"
  | "department"
  | "assignee"
  | "reportType"
  | "reviewStatus"
  | "escalationType"
  | "escalationStatus"
  | "targetGroup";

export type ReportBadge = "priority" | "incidentStatus" | "alertStatus" | "incidentType";

/** How a column is ordered when its header is used to sort the table. */
export type ReportSort = "text" | "date";

export type ReportColumn = {
  key: string;
  label: string;
  badge?: ReportBadge;
  /** When set, the column renders the row's source link (relative route). */
  link?: boolean;
  sort?: ReportSort;
};

export type ReportDefinition = {
  kind: ReportKind;
  name: string;
  shortName: string;
  description: string;
  icon: typeof BellRing;
  /** How the reporting period is applied, so the date basis is never ambiguous. */
  dateBasisNote: string;
  /** Filters the toolbar offers — only those backed by the real data model. */
  filters: ReportFilterKey[];
  columns: ReportColumn[];
  /** Fields the BRD lists that the current data model does not capture. */
  limitationNote?: string;
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    kind: "alert",
    name: "Alert & Advisory Report",
    shortName: "Alerts & Advisories",
    description: "Review every alert and advisory with its category, priority, audience and acknowledgement progress.",
    icon: BellRing,
    dateBasisNote: "Filtered by the date each alert was last updated.",
    filters: ["priority", "status", "category", "audience", "location", "ack"],
    columns: [
      { key: "reference", label: "Reference", link: true, sort: "text" },
      { key: "title", label: "Title", sort: "text" },
      { key: "category", label: "Category", sort: "text" },
      { key: "priority", label: "Priority", badge: "priority", sort: "text" },
      { key: "status", label: "Status", badge: "alertStatus", sort: "text" },
      { key: "audience", label: "Audience", sort: "text" },
      { key: "acknowledgement", label: "Acknowledgement", sort: "text" },
      { key: "published", label: "Published", sort: "date" },
    ],
    limitationNote:
      "Delivery status and opened counts are not captured by the current alert data model and are not included. Recipient, acknowledged and outstanding figures come from the alert acknowledgement data.",
  },
  {
    kind: "incident",
    name: "Incident Report",
    shortName: "Incidents",
    description: "Review reported incidents with their report type, category, workflow state, assignment and location.",
    icon: ClipboardList,
    dateBasisNote: "Filtered by the date each incident was reported.",
    filters: ["reportType", "category", "priority", "status", "reviewStatus", "location", "department", "assignee"],
    columns: [
      { key: "reference", label: "Reference", link: true, sort: "text" },
      { key: "title", label: "Incident", sort: "text" },
      { key: "reportType", label: "Report type", badge: "incidentType", sort: "text" },
      { key: "category", label: "Category", sort: "text" },
      { key: "priority", label: "Priority", badge: "priority", sort: "text" },
      { key: "status", label: "Status", badge: "incidentStatus", sort: "text" },
      { key: "review", label: "Review status", sort: "text" },
      { key: "location", label: "Location", sort: "text" },
      { key: "reported", label: "Reported", sort: "date" },
      { key: "assigned", label: "Assigned", sort: "text" },
    ],
    limitationNote:
      "Structured resolution summaries, verification dates and closure timestamps are not stored in the current incident data model and are not included.",
  },
  {
    kind: "escalation",
    name: "Escalation Report",
    shortName: "Escalations",
    description: "Review recorded escalations from incidents and alerts with their target, trigger reason and state.",
    icon: ArrowUpRight,
    dateBasisNote:
      "Filtered by the timestamp on an explicitly recorded escalation event. Events without a timestamp cannot be included in a date-bounded report.",
    filters: ["escalationType", "escalationStatus", "priority", "targetGroup"],
    columns: [
      { key: "reference", label: "Reference", link: true, sort: "text" },
      { key: "type", label: "Escalation type", sort: "text" },
      { key: "subject", label: "Subject", sort: "text" },
      { key: "target", label: "Target group", sort: "text" },
      { key: "priority", label: "Priority", badge: "priority", sort: "text" },
      { key: "reason", label: "Trigger reason", sort: "text" },
      { key: "escalatedAt", label: "Escalated at", sort: "date" },
      { key: "status", label: "State", sort: "text" },
    ],
    limitationNote:
      "Delivery channel, delivery outcome, acknowledgement status and resolution timestamps are not captured by the current data model and are not included.",
  },
];

export function getReportDefinition(kind: ReportKind): ReportDefinition {
  return REPORT_DEFINITIONS.find((definition) => definition.kind === kind) ?? REPORT_DEFINITIONS[0];
}

export const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "Critical", label: "Critical" },
  { value: "Advisory", label: "Advisory" },
  { value: "Informational", label: "Informational" },
];

export const ACK_OPTIONS = [
  { value: "all", label: "All acknowledgement states" },
  { value: "outstanding", label: "Outstanding" },
  { value: "complete", label: "Complete" },
  { value: "unavailable", label: "Unavailable" },
  { value: "not_required", label: "Not required" },
];

export const ESCALATION_TYPE_OPTIONS = [
  { value: "all", label: "All escalation types" },
  { value: "Incident", label: "Incident escalations" },
  { value: "Alert", label: "Alert escalations" },
];

// Reporting-period presets. "Last 30 days" remains the default; "All time" is
// offered so a user can explicitly widen the period instead of guessing.
export type DateRangePreset = "all" | "7d" | "30d" | "this_month" | "custom";

export type ReportDateRange = {
  preset: DateRangePreset;
  /** yyyy-mm-dd, only used when preset === "custom". */
  start: string;
  end: string;
};

export const DEFAULT_DATE_RANGE: ReportDateRange = { preset: "30d", start: "", end: "" };

export const DATE_PRESET_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

// Label + option strategy for every filter key. "derived" filters build their
// options from the values actually present in the data, so no dropdown is ever
// empty or offers a value the source cannot produce.
export const FILTER_META: Record<
  ReportFilterKey,
  { label: string; allLabel: string; src: "static" | "derived" }
> = {
  priority: { label: "Priority", allLabel: "All priorities", src: "static" },
  status: { label: "Status", allLabel: "All statuses", src: "derived" },
  category: { label: "Category", allLabel: "All categories", src: "derived" },
  audience: { label: "Audience", allLabel: "All audiences", src: "derived" },
  location: { label: "Location", allLabel: "All locations", src: "derived" },
  ack: { label: "Acknowledgement", allLabel: "All acknowledgement states", src: "static" },
  department: { label: "Reporter department", allLabel: "All departments", src: "derived" },
  assignee: { label: "Assigned to", allLabel: "All responders & groups", src: "derived" },
  reportType: { label: "Report type", allLabel: "All report types", src: "derived" },
  reviewStatus: { label: "Review status", allLabel: "All review states", src: "derived" },
  escalationType: { label: "Escalation type", allLabel: "All escalation types", src: "static" },
  escalationStatus: { label: "Escalation state", allLabel: "All escalation states", src: "derived" },
  targetGroup: { label: "Target group", allLabel: "All target groups", src: "derived" },
};
