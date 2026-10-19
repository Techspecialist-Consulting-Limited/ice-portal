import { ArrowUpRight, BellRing, ChartNoAxesCombined, ClipboardList, ContactRound } from "lucide-react";

export type ReportKind = "alert" | "incident" | "escalation" | "usage" | "contact";

export type ReportFilterKey =
  | "priority"
  | "status"
  | "category"
  | "audience"
  | "location"
  | "ack"
  | "department"
  | "assignee"
  | "escalationType"
  | "targetGroup";

export type ReportSourceState = "connected" | "unavailable";

export type ReportBadge = "priority" | "incidentStatus" | "alertStatus";

export type ReportColumn = {
  key: string;
  label: string;
  badge?: ReportBadge;
  /** When set, the column renders the row's source link (relative route). */
  link?: boolean;
};

export type ReportDefinition = {
  kind: ReportKind;
  name: string;
  shortName: string;
  description: string;
  icon: typeof BellRing;
  sourceState: ReportSourceState;
  /** Present when the report cannot be generated because its source is absent. */
  sourceNote?: string;
  /** How the reporting period is applied, so the date basis is never ambiguous. */
  dateBasisNote: string;
  /** Filters the criteria form offers — only those backed by the real data model. */
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
    description: "Every alert and advisory with its priority, audience, acknowledgement progress and shareability.",
    icon: BellRing,
    sourceState: "connected",
    dateBasisNote: "Filtered by the date each alert was last updated.",
    filters: ["priority", "status", "category", "audience", "location", "ack"],
    columns: [
      { key: "reference", label: "Reference", link: true },
      { key: "title", label: "Title" },
      { key: "category", label: "Category" },
      { key: "priority", label: "Priority", badge: "priority" },
      { key: "status", label: "Status", badge: "alertStatus" },
      { key: "audience", label: "Audience" },
      { key: "published", label: "Published" },
      { key: "createdBy", label: "Created by" },
      { key: "recipients", label: "Recipients" },
      { key: "acknowledged", label: "Acknowledged" },
      { key: "outstanding", label: "Outstanding" },
    ],
    limitationNote:
      "Delivery status and opened counts are not captured by the current alert data model and are not included. Recipient, acknowledged and outstanding figures come from the alert acknowledgement data.",
  },
  {
    kind: "incident",
    name: "Incident Report",
    shortName: "Incidents",
    description: "Reported incidents with their category, status, reporter, location and assignment.",
    icon: ClipboardList,
    sourceState: "connected",
    dateBasisNote: "Filtered by the date each incident was reported.",
    filters: ["category", "status", "priority", "department", "location", "assignee"],
    columns: [
      { key: "reference", label: "Reference", link: true },
      { key: "title", label: "Incident" },
      { key: "category", label: "Category" },
      { key: "priority", label: "Priority", badge: "priority" },
      { key: "status", label: "Status", badge: "incidentStatus" },
      { key: "reported", label: "Reported" },
      { key: "reporter", label: "Reporter" },
      { key: "department", label: "Department" },
      { key: "location", label: "Location" },
      { key: "assigned", label: "Assigned" },
      { key: "review", label: "Review status" },
    ],
    limitationNote:
      "Structured resolution summaries, verification dates and closure timestamps are not stored in the current incident data model and are not included.",
  },
  {
    kind: "escalation",
    name: "Escalation Report",
    shortName: "Escalations",
    description: "Escalated incidents and alerts with their target, trigger reason and current status.",
    icon: ArrowUpRight,
    sourceState: "connected",
    dateBasisNote: "Filtered by the timestamp on an explicitly recorded escalation event. Events without a timestamp cannot be included in a date-bounded report.",
    filters: ["escalationType", "targetGroup"],
    columns: [
      { key: "reference", label: "Reference", link: true },
      { key: "type", label: "Escalation type" },
      { key: "subject", label: "Subject" },
      { key: "target", label: "Target group" },
      { key: "priority", label: "Priority", badge: "priority" },
      { key: "reason", label: "Trigger reason" },
      { key: "escalatedAt", label: "Escalated at" },
      { key: "status", label: "State" },
    ],
    limitationNote:
      "Delivery channel, delivery outcome, acknowledgement status and resolution timestamps are not captured by the current data model and are not included.",
  },
  {
    kind: "usage",
    name: "Usage Report",
    shortName: "Usage",
    description: "Portal usage and engagement activity for the reporting period.",
    icon: ChartNoAxesCombined,
    sourceState: "unavailable",
    sourceNote:
      "This report needs a usage and activity data source, which is not connected in this environment. It cannot be generated yet.",
    dateBasisNote: "",
    filters: [],
    columns: [],
  },
  {
    kind: "contact",
    name: "Emergency Contact Completion Report",
    shortName: "Contact completion",
    description: "Progress of emergency contact completion across departments and locations.",
    icon: ContactRound,
    sourceState: "unavailable",
    sourceNote:
      "This report needs an emergency-contact completion data source, which is not connected in this environment. It cannot be generated yet.",
    dateBasisNote: "",
    filters: [],
    columns: [],
  },
];

export function getReportDefinition(kind: ReportKind): ReportDefinition {
  return REPORT_DEFINITIONS.find((definition) => definition.kind === kind) ?? REPORT_DEFINITIONS[0];
}

// Single source for the availability wording. The landing cards, the criteria
// screen and the availability panel all read these, so a report is never
// described two different ways, and "connection required" never drifts into an
// error-styled label that would read as a fault rather than a known gap.
export const REPORT_AVAILABILITY_LABELS = {
  ready: "Data available",
  connectionRequired: "Connection required",
} as const;

export function reportAvailabilityLabel(definition: ReportDefinition): string {
  return definition.sourceState === "connected"
    ? REPORT_AVAILABILITY_LABELS.ready
    : REPORT_AVAILABILITY_LABELS.connectionRequired;
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

// Reporting-period presets. "Last 30 days" is the documented default.
export type DateRangePreset = "7d" | "30d" | "this_month" | "custom";

export type ReportDateRange = {
  preset: DateRangePreset;
  /** yyyy-mm-dd, only used when preset === "custom". */
  start: string;
  end: string;
};

export const DEFAULT_DATE_RANGE: ReportDateRange = { preset: "30d", start: "", end: "" };

export const DATE_PRESET_OPTIONS = [
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
  escalationType: { label: "Escalation type", allLabel: "All escalation types", src: "static" },
  targetGroup: { label: "Target group", allLabel: "All target groups", src: "derived" },
};
