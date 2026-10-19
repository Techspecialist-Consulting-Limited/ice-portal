export type AlertPriority = "Critical" | "Advisory" | "Informational";

// Lifecycle status is distinct from priority: "Critical" is a priority, never a
// lifecycle state. These are the states an alert/advisory can occupy.
export type AlertLifecycleStatus =
  | "Draft"
  | "Published"
  | "Acknowledgement pending"
  | "Escalated"
  | "Updated"
  | "Withdrawn"
  | "Closed";

export type AlertShareability = "Shareable" | "Internal only" | "Restricted";

// Business classification of a communication, distinct from priority: an "Alert"
// notifies staff of something that needs immediate attention, an "Advisory" gives
// guidance. Optional so alerts authored before this field existed remain valid.
export type AlertNotificationType = "Alert" | "Advisory";

// Structured metadata for a history event that records an escalation action.
// Kept to primitive fields so this module stays free of imports from the
// escalation projection; every field is optional because the source only
// records what it actually knows, and the escalation screen labels anything
// absent as "Not recorded" rather than inventing a value.
export type AlertEscalationEventDetails = {
  level?: number;
  levelLabel?: string;
  reason?: string;
  target?: string;
  channel?: string;
  actor?: string;
  /** Recorded escalation outcome (for example "Delivered" or "Failed"), when known. */
  status?: string;
};

export type AlertTimelineEvent = {
  title: string;
  detail: string;
  time: string;
  /** Present only when this event records an escalation action. */
  escalation?: AlertEscalationEventDetails;
};

export type AlertItem = {
  id: string;
  title: string;
  summary?: string;
  category: string;
  priority: AlertPriority;
  status: AlertLifecycleStatus;
  audience: string;
  location: string;
  shareability: AlertShareability;
  acknowledgementRequired: boolean;
  acknowledgementTargetCount?: number;
  acknowledgedCount?: number;
  source: string;
  // Business classification. Optional; set when authored through the incident
  // conversion screen, and left undefined for alerts created directly.
  notificationType?: AlertNotificationType;
  // Set only when this alert was authored by converting a verified incident, so
  // the communication can be traced back to its source incident.
  sourceIncidentId?: string;
  // ISO timestamps. `updatedAt` drives ordering and the date filter; rendering
  // formats them deterministically (UTC) so server and client markup agree.
  publishedAt?: string;
  updatedAt: string;
  createdBy?: string;
  publishedBy?: string;
  history?: AlertTimelineEvent[];
};

// --- Security Feed ---------------------------------------------------------
// The Security Feed is the Risk Administrator's curated situational-awareness
// channel. It is a distinct domain from alerts/advisories: a feed item is
// published content, not a targeted advisory with acknowledgement tracking.
// Lifecycle, pinning, category and source are kept separate on purpose — a
// published item may originate from an approved external source, and source
// ownership is not the same concept as item lifecycle.
export type FeedLifecycleStatus = "Draft" | "Published" | "Withdrawn" | "Archived";

export type FeedSourceType = "Internal" | "External";

// Priority mirrors the alert/incident severity vocabulary so severity is never
// described two ways across the workspace. It is optional on a feed item: most
// situational-awareness content has no severity, and only a minority of items
// (active threats, critical patches) warrant one.
export type FeedPriority = "Critical" | "Advisory" | "Informational";

export type FeedTimelineEvent = {
  title: string;
  detail: string;
  time: string;
};

export type FeedItem = {
  id: string;
  title: string;
  summary?: string;
  category: string;
  status: FeedLifecycleStatus;
  pinned: boolean;
  // `source` is the author/publisher label; `sourceType` distinguishes internal
  // authorship from approved external content. It is never a trust score.
  source: string;
  sourceType: FeedSourceType;
  // ISO timestamps — rendered deterministically (UTC) so server and client
  // markup agree. `updatedAt` drives ordering and the date filter.
  publishedAt?: string;
  updatedAt: string;
  createdBy?: string;
  publishedBy?: string;
  // Optional authoring metadata. These describe the content itself and are kept
  // separate from lifecycle: an audience or shareability scope is not a
  // lifecycle state, and `priority` is only present where a severity applies.
  // `content` is the full item body; `summary` is the short blurb shown in lists.
  content?: string;
  audience?: string;
  shareability?: AlertShareability;
  priority?: FeedPriority;
  history?: FeedTimelineEvent[];
};

// Approved external content sources. Management of these connections belongs to
// the System Administrator; the Risk Administrator curates the content. This
// directory is prototype fixture data (there is no live connector) and is used
// only to describe where external items originate.
export type FeedSource = {
  id: string;
  name: string;
  type: FeedSourceType;
  owner: string;
  approved: boolean;
};

export type IncidentStatus =
  | "Submitted"
  | "Under review"
  | "Verified"
  | "Rejected"
  | "Escalated"
  | "Broadcast"
  | "Resolved"
  | "Closed";

export type IncidentReviewStatus = "Not started" | "Pending" | "In progress" | "Completed";

export type IncidentEvidenceKind = "image" | "video" | "document";

export type IncidentEvidence = {
  name: string;
  size: string;
  type: string;
  uploaded: string;
  uploader: string;
  src?: string;
  kind?: IncidentEvidenceKind;
  demo?: boolean;
};

export type IncidentTimelineEvent = {
  title: string;
  detail: string;
  time: string;
};

export type IncidentAssignment = {
  assignee?: string;
  assigneeId?: string;
  assigneeRole?: string;
  team?: string;
  note?: string;
  assignedAt?: string;
  escalated?: boolean;
  escalationReason?: string;
  escalatedAt?: string;
  urgency?: "Low" | "Medium" | "High" | "Critical";
};

export type IncidentResponder = {
  id: string;
  name: string;
  role: string;
  team: string;
  department?: string;
};

export type IncidentResponseTeam = {
  id: string;
  name: string;
  function: string;
  department?: string;
};

export type IncidentItem = {
  id: string;
  title: string;
  category: string;
  location: string;
  priority: "Critical" | "Advisory" | "Informational";
  status: IncidentStatus;
  reported: string;
  reviewStatus: IncidentReviewStatus;
  actionLabel: string;
  description?: string;
  reporter?: string;
  department?: string;
  channel?: string;
  floorArea?: string;
  watchers?: number;
  timeline?: IncidentTimelineEvent[];
  evidence?: IncidentEvidence[];
  reviewNote?: string;
  reviewer?: string;
  assignment?: IncidentAssignment;
  resolutionSummary?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  closedAt?: string;
  closedBy?: string;
};

// Illustrative mock data for the Risk Administrator dashboard prototype.
// This is the single source of truth for alerts/advisories: the dashboard and
// the Alerts & Advisories page both read from here (via the shared alert store),
// so their totals and acknowledgement figures always agree.
export const alerts: AlertItem[] = [
  {
    id: "A-1043",
    title: "Road disruption near Kano office",
    summary:
      "A road traffic incident on the eastern approach may delay staff travel. Allow additional travel time and follow marshal guidance.",
    category: "Operations",
    priority: "Advisory",
    status: "Published",
    audience: "General NSIA Group",
    location: "Kano office",
    shareability: "Shareable",
    acknowledgementRequired: false,
    source: "Operations",
    publishedAt: "2026-10-16T08:05:00Z",
    updatedAt: "2026-10-16T08:05:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1042",
    title: "Server room evacuation",
    summary:
      "The Abuja HQ server room has been evacuated following smoke detection. Do not re-enter until Facilities confirms it is safe.",
    category: "Fire & safety",
    priority: "Critical",
    status: "Acknowledgement pending",
    audience: "Abuja HQ staff",
    location: "Abuja HQ",
    shareability: "Restricted",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 480,
    acknowledgedCount: 420,
    source: "OPS",
    publishedAt: "2026-10-16T09:55:00Z",
    updatedAt: "2026-10-16T10:12:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1041",
    title: "Lagos service entrance closure",
    summary:
      "The Lagos office service entrance is closed for repairs. Use the main reception entrance until further notice.",
    category: "Facilities",
    priority: "Advisory",
    status: "Acknowledgement pending",
    audience: "Lagos office staff",
    location: "Lagos office",
    shareability: "Internal only",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 220,
    acknowledgedCount: 198,
    source: "Logistics",
    publishedAt: "2026-10-16T09:40:00Z",
    updatedAt: "2026-10-16T09:55:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1040",
    title: "Generator maintenance window",
    summary: "A planned generator test will run this evening. Expect brief interruptions to non-essential power circuits.",
    category: "Facilities",
    priority: "Informational",
    status: "Published",
    audience: "Abuja HQ staff",
    location: "Abuja HQ",
    shareability: "Internal only",
    acknowledgementRequired: false,
    source: "Facilities",
    publishedAt: "2026-10-16T07:30:00Z",
    updatedAt: "2026-10-15T17:20:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1039",
    title: "Power restoration update",
    summary:
      "Power has been restored to all affected blocks. Facilities is monitoring stability. No further action is required.",
    category: "Facilities",
    priority: "Informational",
    status: "Updated",
    audience: "Kano office staff",
    location: "Kano office",
    shareability: "Internal only",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 45,
    acknowledgedCount: 45,
    source: "Facilities",
    publishedAt: "2026-10-15T08:15:00Z",
    updatedAt: "2026-10-15T08:40:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1038",
    title: "Water supply disruption",
    summary:
      "Water supply to the Port Harcourt annex was interrupted during repairs. Supply has been restored and the advisory is closed.",
    category: "Facilities",
    priority: "Advisory",
    status: "Closed",
    audience: "Port Harcourt staff",
    location: "Port Harcourt",
    shareability: "Internal only",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 65,
    acknowledgedCount: 65,
    source: "Operations",
    publishedAt: "2026-10-09T08:00:00Z",
    updatedAt: "2026-10-09T08:20:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1037",
    title: "Medical advisory: heat stress",
    summary:
      "With high temperatures forecast, take regular breaks, stay hydrated and report symptoms to the medical room immediately.",
    category: "Medical",
    priority: "Advisory",
    status: "Acknowledgement pending",
    audience: "All staff",
    location: "Abuja HQ",
    shareability: "Shareable",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 160,
    acknowledgedCount: 96,
    source: "Medical Services",
    publishedAt: "2026-10-15T11:05:00Z",
    updatedAt: "2026-10-15T11:30:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1036",
    title: "Communications outage",
    summary:
      "Core communications services at the Enugu hub remained degraded beyond the acknowledgement window. The alert has been escalated.",
    category: "ICT",
    priority: "Critical",
    status: "Escalated",
    audience: "Enugu hub staff",
    location: "Enugu hub",
    shareability: "Restricted",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 300,
    acknowledgedCount: 240,
    source: "Network",
    publishedAt: "2026-10-14T07:30:00Z",
    updatedAt: "2026-10-14T07:50:00Z",
    publishedBy: "Mike Kanu",
    history: [
      {
        title: "Alert escalated",
        detail:
          "Escalated by Mike Kanu (Risk Administrator). Reason: core communications services at the Enugu hub stayed degraded beyond the acknowledgement window.",
        time: "2026-10-14T09:15:00Z",
        escalation: {
          reason:
            "Core communications services at the Enugu hub stayed degraded beyond the acknowledgement window.",
          actor: "Mike Kanu",
        },
      },
    ],
  },
  {
    id: "A-1035",
    title: "Gate access policy update",
    summary:
      "Updates to site gate access and visitor sign-in take effect this week. Please acknowledge and review the new procedure.",
    category: "Security",
    priority: "Advisory",
    status: "Updated",
    audience: "All staff",
    location: "All sites",
    shareability: "Internal only",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 520,
    acknowledgedCount: 520,
    source: "Security",
    publishedAt: "2026-10-08T09:00:00Z",
    updatedAt: "2026-10-12T15:10:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1034",
    title: "Field inspection notice",
    summary: "The scheduled field inspection has been completed and the notice is closed.",
    category: "Operations",
    priority: "Informational",
    status: "Closed",
    audience: "Operations staff",
    location: "Kaduna",
    shareability: "Internal only",
    acknowledgementRequired: false,
    source: "Safety",
    publishedAt: "2026-10-04T06:10:00Z",
    updatedAt: "2026-10-04T06:20:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1033",
    title: "Temporary lift outage",
    summary: "Draft notice covering a planned lift outage at the Lagos office. Pending review before publishing.",
    category: "Facilities",
    priority: "Informational",
    status: "Draft",
    audience: "Lagos office staff",
    location: "Lagos office",
    shareability: "Internal only",
    acknowledgementRequired: false,
    source: "Facilities",
    updatedAt: "2026-10-16T06:45:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "A-1032",
    title: "Perimeter drill notice",
    summary: "This perimeter drill notice was withdrawn and replaced by an updated security communication.",
    category: "Security",
    priority: "Informational",
    status: "Withdrawn",
    audience: "Abuja HQ staff",
    location: "Abuja HQ",
    shareability: "Internal only",
    acknowledgementRequired: false,
    source: "Security",
    publishedAt: "2026-10-03T08:00:00Z",
    updatedAt: "2026-10-03T09:15:00Z",
    publishedBy: "Mike Kanu",
  },
];

// Illustrative evidence fixtures. The referenced files are local assets served
// from /public/evidence; they stand in for captured incident media. Keep them
// clearly separated from real uploads when a backend media store is connected.
export const demoIncidentEvidence: IncidentEvidence[] = [
  {
    name: "server-room-overview.svg",
    size: "4 KB",
    type: "SVG image",
    kind: "image",
    uploaded: "06 Oct 2026 · 09:59",
    uploader: "Amina Yusuf",
    src: "/evidence/server-room-overview.svg",
    demo: true,
  },
  {
    name: "server-room-rack-closeup.svg",
    size: "4 KB",
    type: "SVG image",
    kind: "image",
    uploaded: "06 Oct 2026 · 09:59",
    uploader: "Amina Yusuf",
    src: "/evidence/server-room-rack-closeup.svg",
    demo: true,
  },
  {
    name: "fire-panel-2nd-floor.svg",
    size: "3 KB",
    type: "SVG image",
    kind: "image",
    uploaded: "06 Oct 2026 · 10:01",
    uploader: "Amina Yusuf",
    src: "/evidence/fire-panel-2nd-floor.svg",
    demo: true,
  },
  {
    name: "smoke-damage-assessment.txt",
    size: "1 KB",
    type: "Text document",
    kind: "document",
    uploaded: "06 Oct 2026 · 10:04",
    uploader: "Amina Yusuf",
    src: "/evidence/smoke-damage-assessment.txt",
    demo: true,
  },
];

// Stand-in responder and team directory used by the assignment flow. These are
// fixtures, not a real staff directory: do not treat them as live people,
// availability, or on-call state. Swap for the real directory when a connector
// exists. Export names are unchanged so the assignment flow is untouched.
export const demoResponders: IncidentResponder[] = [
  { id: "RSP-01", name: "Amina Hassan", role: "Fire Safety Officer", team: "Emergency Response", department: "Facilities Department" },
  { id: "RSP-02", name: "Kola Adebayo", role: "Facilities Engineer", team: "Facilities Response", department: "Facilities Department" },
  { id: "RSP-03", name: "Priya Nwosu", role: "Security Supervisor", team: "Security Response", department: "Security Department" },
  { id: "RSP-04", name: "Samuel Okafor", role: "Medical Officer", team: "Medical Response", department: "Medical Services" },
  { id: "RSP-05", name: "Ngozi Eze", role: "ICT Infrastructure Lead", team: "ICT Response", department: "ICT Department" },
  { id: "RSP-06", name: "Ibrahim Musa", role: "Operations Coordinator", team: "Emergency Response", department: "Operations" },
];

export const demoResponseTeams: IncidentResponseTeam[] = [
  { id: "TM-01", name: "Emergency Response", function: "Fire & safety response", department: "Facilities Department" },
  { id: "TM-02", name: "Facilities Response", function: "Building & utilities", department: "Facilities Department" },
  { id: "TM-03", name: "Security Response", function: "Access & perimeter", department: "Security Department" },
  { id: "TM-04", name: "Medical Response", function: "First aid & medical", department: "Medical Services" },
  { id: "TM-05", name: "ICT Response", function: "Infrastructure & network", department: "ICT Department" },
];

export const incidents: IncidentItem[] = [
  {
    id: "INC-2026-0148",
    title: "Smoke detected in server room",
    category: "Fire & safety",
    location: "Abuja HQ",
    priority: "Critical",
    status: "Submitted",
    reported: "06 Oct 2026 · 09:58",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "Smoke was detected in the server room on the 2nd floor. Building staff activated the alarm and evacuated the area. The report included a video and still photos of the incident.",
    reporter: "Amina Yusuf",
    department: "Facilities Department",
    channel: "Mobile app",
    floorArea: "2nd floor · Server room",
    watchers: 3,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Amina Yusuf.", time: "06 Oct 2026 · 09:58" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "06 Oct 2026 · 09:58" },
    ],
    evidence: demoIncidentEvidence,
  },
  {
    id: "INC-2026-0147",
    title: "Water ingress at service entrance",
    category: "Facilities",
    location: "Lagos office",
    priority: "Advisory",
    status: "Under review",
    reported: "06 Oct 2026 · 09:46",
    reviewStatus: "In progress",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0146",
    title: "Unattended bag at reception",
    category: "Security",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Submitted",
    reported: "06 Oct 2026 · 09:42",
    reviewStatus: "Not started",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0145",
    title: "Medical assistance in east lobby",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Critical",
    status: "Verified",
    reported: "06 Oct 2026 · 09:41",
    reviewStatus: "Completed",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0144",
    title: "Access control interruption",
    category: "Security",
    location: "Kano office",
    priority: "Advisory",
    status: "Under review",
    reported: "06 Oct 2026 · 09:30",
    reviewStatus: "In progress",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0143",
    title: "Minor fire in storage area",
    category: "Fire & safety",
    location: "Lagos office",
    priority: "Critical",
    status: "Submitted",
    reported: "05 Oct 2026 · 14:12",
    reviewStatus: "Not started",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0142",
    title: "Employee slip and fall",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Verified",
    reported: "05 Oct 2026 · 12:04",
    reviewStatus: "Completed",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0141",
    title: "Suspicious activity near gate",
    category: "Security",
    location: "Kano office",
    priority: "Informational",
    status: "Broadcast",
    reported: "05 Oct 2026 · 11:18",
    reviewStatus: "Completed",
    actionLabel: "View",
  },
  {
    id: "INC-2026-0140",
    title: "Power fluctuation in warehouse",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Under review",
    reported: "05 Oct 2026 · 10:51",
    reviewStatus: "Pending",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0139",
    title: "Generator startup failure",
    category: "Facilities",
    location: "Kano office",
    priority: "Critical",
    status: "Escalated",
    reported: "05 Oct 2026 · 10:14",
    reviewStatus: "Pending",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0138",
    title: "Suspected phishing email reported",
    category: "Security",
    location: "Lagos office",
    priority: "Informational",
    status: "Submitted",
    reported: "05 Oct 2026 · 09:33",
    reviewStatus: "Not started",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0137",
    title: "Air quality alarm in labs",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Under review",
    reported: "04 Oct 2026 · 18:09",
    reviewStatus: "In progress",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0136",
    title: "Roof leak near conference hall",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Submitted",
    reported: "04 Oct 2026 · 17:42",
    reviewStatus: "Not started",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0135",
    title: "Vehicle access rejected at gate B",
    category: "Security",
    location: "Kano office",
    priority: "Informational",
    status: "Verified",
    reported: "04 Oct 2026 · 17:05",
    reviewStatus: "Completed",
    actionLabel: "View",
  },
  {
    id: "INC-2026-0134",
    title: "Heat stress in loading dock",
    category: "Medical",
    location: "Lagos office",
    priority: "Critical",
    status: "Under review",
    reported: "04 Oct 2026 · 16:28",
    reviewStatus: "Pending",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0133",
    title: "Warehouse fire alarm reset",
    category: "Fire & safety",
    location: "Abuja HQ",
    priority: "Critical",
    status: "Verified",
    reported: "04 Oct 2026 · 15:58",
    reviewStatus: "Completed",
    actionLabel: "View",
  },
  {
    id: "INC-2026-0132",
    title: "Visitor check-in terminal down",
    category: "Security",
    location: "Kano office",
    priority: "Advisory",
    status: "Under review",
    reported: "03 Oct 2026 · 15:17",
    reviewStatus: "In progress",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0131",
    title: "Medication stock discrepancy",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Submitted",
    reported: "03 Oct 2026 · 14:48",
    reviewStatus: "Not started",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0130",
    title: "Public address system outage",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Informational",
    status: "Broadcast",
    reported: "03 Oct 2026 · 14:12",
    reviewStatus: "Completed",
    actionLabel: "View",
  },
  {
    id: "INC-2026-0129",
    title: "Security escort request delay",
    category: "Security",
    location: "Lagos office",
    priority: "Critical",
    status: "Escalated",
    reported: "03 Oct 2026 · 13:34",
    reviewStatus: "Pending",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0128",
    title: "Water tank overflow alert",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Verified",
    reported: "02 Oct 2026 · 12:41",
    reviewStatus: "Completed",
    actionLabel: "View",
  },
  {
    id: "INC-2026-0127",
    title: "Defective AED cabinet activated",
    category: "Medical",
    location: "Kano office",
    priority: "Informational",
    status: "Submitted",
    reported: "02 Oct 2026 · 11:55",
    reviewStatus: "Not started",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0126",
    title: "Breach alert at perimeter fence",
    category: "Security",
    location: "Abuja HQ",
    priority: "Critical",
    status: "Under review",
    reported: "02 Oct 2026 · 11:09",
    reviewStatus: "Pending",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0125",
    title: "Lift malfunction at east wing",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Submitted",
    reported: "02 Oct 2026 · 10:52",
    reviewStatus: "Not started",
    actionLabel: "Review",
  },
  {
    id: "INC-2026-0124",
    title: "Staff first aid response deployed",
    category: "Medical",
    location: "Kano office",
    priority: "Informational",
    status: "Verified",
    reported: "01 Oct 2026 · 09:08",
    reviewStatus: "Completed",
    actionLabel: "View",
  },
];

// Illustrative demo sources for the Security Feed prototype. The directory lists
// which external sources are approved and who owns them; it does not represent a
// live connector or a sync schedule. The Risk Administrator curates content;
// adding/removing approved sources is a System Administrator responsibility.
export const feedSources: FeedSource[] = [
  { id: "SRC-EXT-01", name: "NCSC Advisory", type: "External", owner: "System Administrator", approved: true },
  { id: "SRC-EXT-02", name: "GSOC Regional Bulletin", type: "External", owner: "System Administrator", approved: true },
  { id: "SRC-EXT-03", name: "National Met Service", type: "External", owner: "System Administrator", approved: true },
  { id: "SRC-EXT-04", name: "Vendor Security Bulletins", type: "External", owner: "System Administrator", approved: true },
  { id: "SRC-INT-01", name: "Security Desk", type: "Internal", owner: "Risk Administrator", approved: true },
  { id: "SRC-INT-02", name: "Risk & Compliance", type: "Internal", owner: "Risk Administrator", approved: true },
  { id: "SRC-INT-03", name: "Facilities", type: "Internal", owner: "Risk Administrator", approved: true },
  { id: "SRC-INT-04", name: "ICT Operations", type: "Internal", owner: "Risk Administrator", approved: true },
  { id: "SRC-INT-05", name: "Medical Services", type: "Internal", owner: "Risk Administrator", approved: true },
  { id: "SRC-INT-06", name: "Operations", type: "Internal", owner: "Risk Administrator", approved: true },
];

// Canonical Security Feed records. The Security Feed page and the dashboard's
// Security Feed Activity panel both read this list (via the shared feed store),
// so their published/pinned counts and activity always agree. Prototype fixture
// data — local only, no backend and no external connector.
export const feeds: FeedItem[] = [
  {
    id: "FD-2114",
    title: "Phishing campaign impersonating internal IT",
    summary:
      "An active phishing campaign is impersonating the internal IT service desk. Do not open unexpected credential-reset links; report suspected messages to the security desk.",
    category: "Security",
    status: "Published",
    pinned: true,
    source: "NCSC Advisory",
    sourceType: "External",
    content:
      "The internal IT service desk has reported a phishing campaign using look-alike sender addresses and a fake credential-reset landing page. Do not open unexpected password-reset links or attachments — the service desk will never ask for your password by email. Report suspected messages with the Report Phishing action, and contact the security desk immediately if you have already entered credentials.",
    audience: "All staff",
    shareability: "Internal only",
    priority: "Critical",
    publishedAt: "2026-10-16T09:30:00Z",
    updatedAt: "2026-10-16T09:30:00Z",
    publishedBy: "Mike Kanu",
    history: [
      { title: "External source received", detail: "Advisory received from the approved NCSC Advisory source.", time: "16 Oct 2026 · 09:12" },
      { title: "Item published", detail: "Reviewed and published to the Security Feed by Mike Kanu.", time: "16 Oct 2026 · 09:30" },
    ],
  },
  {
    id: "FD-2113",
    title: "Visitor screening procedure reminder",
    summary:
      "Reminder to apply the updated visitor screening steps at all reception points, including photo ID checks and escorted access for contractors.",
    category: "Security",
    status: "Published",
    pinned: false,
    source: "Security Desk",
    sourceType: "Internal",
    content:
      "Apply the updated visitor screening steps at every reception point: confirm a photo ID against the visitor record, issue a dated badge, and escort contractors beyond the lobby. Do not admit visitors whose host cannot be reached. Escalate any refused or suspicious attempt to the security desk immediately.",
    audience: "Reception and security staff",
    shareability: "Internal only",
    publishedAt: "2026-10-16T08:40:00Z",
    updatedAt: "2026-10-16T08:40:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "FD-2112",
    title: "Regional protest activity near Kano corridor",
    summary:
      "Regional bulletin reports planned protest activity near the Kano office corridor this week. Avoid non-essential travel and follow transport guidance.",
    category: "Travel",
    status: "Published",
    pinned: true,
    source: "GSOC Regional Bulletin",
    sourceType: "External",
    content:
      "The regional bulletin reports planned protest activity near the Kano office corridor this week, with possible road closures and transport delays. Avoid non-essential travel along the affected routes, follow marshal guidance, and confirm your route with the transport desk before departing. Report any disruption to the security desk.",
    audience: "Kano office staff",
    shareability: "Internal only",
    priority: "Advisory",
    publishedAt: "2026-10-16T07:55:00Z",
    updatedAt: "2026-10-16T08:05:00Z",
    publishedBy: "Mike Kanu",
    history: [
      { title: "External source received", detail: "Bulletin received from the approved GSOC Regional Bulletin source.", time: "16 Oct 2026 · 07:55" },
      { title: "Item published", detail: "Reviewed and published to the Security Feed by Mike Kanu.", time: "16 Oct 2026 · 08:05" },
    ],
  },
  {
    id: "FD-2111",
    title: "Security awareness theme for next month",
    summary:
      "Draft planning note for the next security awareness theme. Pending review before publishing to staff.",
    category: "Awareness",
    status: "Draft",
    pinned: false,
    source: "Risk & Compliance",
    sourceType: "Internal",
    content:
      "Draft planning note for next month's security awareness theme. The intended focus is social-engineering awareness, with a short briefing for team leads and a set of posters for common areas. This is a draft and has not been reviewed or published.",
    audience: "All staff",
    shareability: "Internal only",
    updatedAt: "2026-10-16T06:50:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2110",
    title: "VPN maintenance and expected reconnect prompts",
    summary:
      "Planned VPN maintenance will require staff to reconnect overnight. Expected reconnect prompts are legitimate and do not require credentials to be re-entered on any external page.",
    category: "ICT",
    status: "Published",
    pinned: false,
    source: "ICT Operations",
    sourceType: "Internal",
    content:
      "Planned VPN maintenance overnight will require staff to reconnect. Reconnection prompts are legitimate and do not require credentials to be re-entered on any external page. If you are asked for credentials outside the normal sign-in page, stop and report it to the security desk.",
    audience: "All staff",
    shareability: "Internal only",
    publishedAt: "2026-10-15T16:00:00Z",
    updatedAt: "2026-10-15T16:00:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "FD-2109",
    title: "Severe weather outlook for Lagos region",
    summary:
      "National forecast indicates heavy rainfall and localised flooding risk. Staff should plan travel accordingly and allow additional time.",
    category: "Travel",
    status: "Published",
    pinned: false,
    source: "National Met Service",
    sourceType: "External",
    content:
      "The national forecast indicates heavy rainfall and localised flooding risk in the Lagos region over the coming days. Plan travel accordingly, allow additional time, and avoid routes prone to flooding. Report any travel disruption or safety concern to the security desk.",
    audience: "Lagos office staff",
    shareability: "Internal only",
    priority: "Advisory",
    publishedAt: "2026-10-15T14:20:00Z",
    updatedAt: "2026-10-15T14:20:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "FD-2108",
    title: "Access card replacement notice",
    summary:
      "This replacement notice was withdrawn after the card vendor confirmed the original cards remain valid.",
    category: "Security",
    status: "Withdrawn",
    pinned: false,
    source: "Security Desk",
    sourceType: "Internal",
    publishedAt: "2026-10-14T10:05:00Z",
    updatedAt: "2026-10-14T13:30:00Z",
    publishedBy: "Mike Kanu",
    history: [
      { title: "Item published", detail: "Published to the Security Feed by Mike Kanu.", time: "14 Oct 2026 · 10:05" },
      { title: "Item withdrawn", detail: "Withdrawn by Mike Kanu after vendor confirmation. Retained for audit history.", time: "14 Oct 2026 · 13:30" },
    ],
  },
  {
    id: "FD-2107",
    title: "Seasonal health guidance: hydration and heat",
    summary:
      "Medical Services guidance for high temperatures: take regular breaks, stay hydrated and report symptoms to the medical room promptly.",
    category: "Medical",
    status: "Published",
    pinned: false,
    source: "Medical Services",
    sourceType: "Internal",
    content:
      "During high temperatures, take regular breaks, stay hydrated, and avoid prolonged exposure to direct sun. Report symptoms such as dizziness, headache or nausea to the medical room promptly. Keep an eye on colleagues working outdoors.",
    audience: "All staff",
    shareability: "Shareable",
    publishedAt: "2026-10-14T09:15:00Z",
    updatedAt: "2026-10-14T09:15:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "FD-2106",
    title: "Quarterly evacuation drill summary",
    summary:
      "Summary of the completed quarterly evacuation drill, including participation and follow-up actions. Archived after the reporting cycle closed.",
    category: "Safety",
    status: "Archived",
    pinned: false,
    source: "Operations",
    sourceType: "Internal",
    publishedAt: "2026-10-10T11:00:00Z",
    updatedAt: "2026-10-13T08:00:00Z",
    publishedBy: "Mike Kanu",
    history: [
      { title: "Item published", detail: "Published to the Security Feed by Mike Kanu.", time: "10 Oct 2026 · 11:00" },
      { title: "Item archived", detail: "Archived after the reporting cycle closed. Retained for audit history.", time: "13 Oct 2026 · 08:00" },
    ],
  },
  {
    id: "FD-2105",
    title: "Critical patch available for perimeter appliances",
    summary:
      "Vendor bulletin announces a critical patch for perimeter security appliances. ICT Operations is scheduling the update; no action is required from staff.",
    category: "ICT",
    status: "Published",
    pinned: true,
    source: "Vendor Security Bulletins",
    sourceType: "External",
    content:
      "The vendor bulletin announces a critical patch for the perimeter security appliances. ICT Operations is scheduling the update during the next maintenance window. No action is required from staff; the expected interruption to external services is under ten minutes.",
    audience: "ICT Operations",
    shareability: "Internal only",
    priority: "Critical",
    publishedAt: "2026-10-13T12:45:00Z",
    updatedAt: "2026-10-13T13:10:00Z",
    publishedBy: "Mike Kanu",
    history: [
      { title: "External source received", detail: "Bulletin received from the approved Vendor Security Bulletins source.", time: "13 Oct 2026 · 12:45" },
      { title: "Item published", detail: "Reviewed and published to the Security Feed by Mike Kanu.", time: "13 Oct 2026 · 13:10" },
    ],
  },
  {
    id: "FD-2104",
    title: "Loading dock safety briefing",
    summary:
      "Draft briefing covering updated loading dock safety steps. Pending Facilities review before publishing.",
    category: "Safety",
    status: "Draft",
    pinned: false,
    source: "Facilities",
    sourceType: "Internal",
    updatedAt: "2026-10-13T10:20:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2103",
    title: "Fire panel test schedule",
    summary:
      "Facilities will test fire panels across the site this week. Brief alarm activations during test windows are expected and do not require action.",
    category: "Safety",
    status: "Published",
    pinned: false,
    source: "Facilities",
    sourceType: "Internal",
    publishedAt: "2026-10-12T07:30:00Z",
    updatedAt: "2026-10-12T07:30:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "FD-2102",
    title: "Regional travel advisory (superseded)",
    summary:
      "Superseded regional travel advisory. Withdrawn and replaced by a refreshed bulletin from the same source.",
    category: "Travel",
    status: "Withdrawn",
    pinned: false,
    source: "GSOC Regional Bulletin",
    sourceType: "External",
    publishedAt: "2026-10-08T09:00:00Z",
    updatedAt: "2026-10-11T15:40:00Z",
    publishedBy: "Mike Kanu",
    history: [
      { title: "External source received", detail: "Bulletin received from the approved GSOC Regional Bulletin source.", time: "08 Oct 2026 · 09:00" },
      { title: "Item withdrawn", detail: "Withdrawn by Mike Kanu and superseded by a refreshed bulletin. Retained for audit history.", time: "11 Oct 2026 · 15:40" },
    ],
  },
  {
    id: "FD-2101",
    title: "Clean desk reminder campaign",
    summary:
      "Archived clean-desk awareness reminder campaign from the previous cycle. Retained for reference.",
    category: "Awareness",
    status: "Archived",
    pinned: false,
    source: "Security Desk",
    sourceType: "Internal",
    publishedAt: "2026-10-03T08:00:00Z",
    updatedAt: "2026-10-06T09:00:00Z",
    publishedBy: "Mike Kanu",
  },
];
