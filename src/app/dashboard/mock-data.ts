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
// Every item is authored and published by the Risk Administrator (NSIA), so
// there is no external feed source. "Draft" is an item that has not been
// published yet.
export type FeedLifecycleStatus = "Draft" | "Published" | "Withdrawn" | "Archived";

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

export type IncidentStatus =
  | "Submitted"
  | "Under review"
  | "Verified"
  | "Rejected"
  | "Escalated"
  | "Broadcast"
  | "Resolved"
  | "Closed";

export type IncidentType = "SOS" | "Emergency Report" | "Incident Report";

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
  actor?: string;
  actorId?: string;
};

export type IncidentAssignment = {
  assignee?: string;
  assigneeId?: string;
  assigneeRole?: string;
  team?: string;
  note?: string;
  assignedAt?: string;
  assignedBy?: string;
  assignedById?: string;
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
  incidentType?: IncidentType;
  reported: string;
  /** Canonical UTC instant for accurate filtering and Africa/Lagos display. */
  reportedAt?: string;
  reviewStatus: IncidentReviewStatus;
  actionLabel: string;
  description?: string;
  reporter?: string;
  /** Directory account ID of the reporter; the only supported link to contact/emergency-contact records. */
  reporterId?: string;
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
    publishedAt: "2026-10-15T11:05:00Z",
    updatedAt: "2026-10-15T11:30:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1036",
    title: "Communications outage at Abuja HQ",
    summary:
      "Core communications services at Abuja HQ remain degraded. ICT response teams are investigating the disruption.",
    category: "ICT",
    priority: "Critical",
    status: "Escalated",
    audience: "Abuja HQ staff",
    location: "Abuja HQ",
    shareability: "Restricted",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 300,
    acknowledgedCount: 240,
    publishedAt: "2026-10-14T07:30:00Z",
    updatedAt: "2026-10-14T07:50:00Z",
    publishedBy: "Mike Kanu",
    history: [
      {
        title: "Alert escalated",
        detail:
          "Escalated by Mike Kanu (Risk Administrator). Reason: core communications services at Abuja HQ remained degraded beyond the acknowledgement window.",
        time: "2026-10-14T09:15:00Z",
        escalation: {
          reason:
            "Core communications services at Abuja HQ remained degraded beyond the acknowledgement window.",
          actor: "Mike Kanu",
        },
      },
    ],
  },
  {
    id: "A-1031",
    title: "Road blocked on approach to Abuja HQ",
    summary:
      "A road blockage is affecting access to Abuja HQ. Staff should avoid the affected route and follow official travel guidance.",
    category: "Security",
    priority: "Critical",
    status: "Published",
    audience: "Abuja HQ staff",
    location: "Abuja HQ",
    shareability: "Restricted",
    acknowledgementRequired: false,
    publishedAt: "2026-10-16T10:30:00Z",
    updatedAt: "2026-10-16T10:30:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "A-1030",
    title: "Civil disturbance near Abuja Central Area",
    summary:
      "A civil disturbance has been reported near the Abuja Central Area. Staff in the vicinity should remain in a secure location and follow official guidance.",
    category: "Security",
    priority: "Critical",
    status: "Acknowledgement pending",
    audience: "Abuja HQ staff",
    location: "Abuja Central Area",
    shareability: "Restricted",
    acknowledgementRequired: true,
    acknowledgementTargetCount: 480,
    acknowledgedCount: 356,
    publishedAt: "2026-10-16T10:45:00Z",
    updatedAt: "2026-10-16T10:45:00Z",
    publishedBy: "Mike Kanu",
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
  { id: "RSP-03", name: "Abbas Taofeeq", role: "Incident Responder", team: "Security Response", department: "Security Department" },
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
    incidentType: "SOS",
    reported: "05 Nov 2026 · 09:58",
    reportedAt: "2026-11-05T08:58:00.000Z",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "Smoke was detected in the server room on the 2nd floor. Building staff activated the alarm and evacuated the area. The report included a video and still photos of the incident.",
    reporter: "Amina Yusuf",
    reporterId: "USR-0013",
    department: "Executive Management",
    channel: "Mobile app",
    floorArea: "2nd floor · Server room",
    watchers: 3,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Amina Yusuf.", time: "05 Nov 2026 · 09:58" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "05 Nov 2026 · 09:58" },
    ],
    evidence: demoIncidentEvidence,
  },
  {
    id: "INC-2026-0147",
    title: "Water ingress at service entrance",
    category: "Facilities",
    location: "Asokoro",
    priority: "Advisory",
    status: "Submitted",
    incidentType: "Emergency Report",
    reported: "05 Nov 2026 · 10:21",
    reportedAt: "2026-11-05T09:21:00.000Z",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "Water is seeping under the service entrance door after overnight rain and pooling on the corridor floor. A wet-floor sign has been placed.",
    reporter: "Aisha Mohammed",
    reporterId: "STF-0009",
    department: "Facilities Department",
    channel: "Mobile app",
    floorArea: "Ground floor · Service entrance",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Aisha Mohammed.", time: "05 Nov 2026 · 10:21" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "05 Nov 2026 · 10:21" },
    ],
  },
  {
    id: "INC-2026-0146",
    title: "Unattended bag at reception",
    category: "Security",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Submitted",
    incidentType: "Incident Report",
    reported: "05 Nov 2026 · 11:07",
    reportedAt: "2026-11-05T10:07:00.000Z",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "An unattended black backpack was left beside the reception desk for over 20 minutes. Nobody has claimed it and the area has been kept clear.",
    reporter: "Yakubu Danladi",
    reporterId: "STF-0012",
    department: "Security Department",
    channel: "Mobile app",
    floorArea: "Ground floor · Main reception",
    watchers: 3,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Yakubu Danladi.", time: "05 Nov 2026 · 11:07" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "05 Nov 2026 · 11:07" },
    ],
  },
  {
    id: "INC-2026-0145",
    title: "Medical assistance in east lobby",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Critical",
    status: "Verified",
    incidentType: "SOS",
    reported: "06 Oct 2026 · 09:41",
    reviewStatus: "Completed",
    actionLabel: "Review",
    description: "A visitor collapsed in the east lobby and is conscious but disoriented. The reporter pressed SOS and is staying with the person until help arrives.",
    reporter: "Mariam Ibrahim",
    reporterId: "STF-0001",
    department: "Abuja Operations",
    channel: "Mobile app",
    floorArea: "Ground floor · East lobby",
    watchers: 3,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Mariam Ibrahim.", time: "06 Oct 2026 · 09:41" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "06 Oct 2026 · 09:51" },
      { title: "Responder assigned", detail: "Abbas Taofeeq assigned by Mike Kanu (Risk Administrator) to handle the incident (Security Response).", time: "06 Oct 2026 · 09:52" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Abbas Taofeeq",
      assigneeId: "RSP-03",
      assigneeRole: "Incident Responder",
      team: "Security Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "06 Oct 2026 · 09:52",
      urgency: "Critical",
    },
  },
  {
    id: "INC-2026-0142",
    title: "Employee slip and fall",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Verified",
    incidentType: "Emergency Report",
    reported: "05 Oct 2026 · 12:04",
    reviewStatus: "Completed",
    actionLabel: "Review",
    description: "An employee slipped on a wet floor near the canteen and is complaining of wrist and hip pain. First-aid support has been requested.",
    reporter: "Tunde Bakare",
    reporterId: "STF-0008",
    department: "Abuja Operations",
    channel: "Mobile app",
    floorArea: "1st floor · Staff canteen corridor",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Tunde Bakare.", time: "05 Oct 2026 · 12:04" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "05 Oct 2026 · 12:14" },
      { title: "Responder assigned", detail: "Abbas Taofeeq assigned by Mike Kanu (Risk Administrator) to handle the incident (Security Response).", time: "05 Oct 2026 · 12:15" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Abbas Taofeeq",
      assigneeId: "RSP-03",
      assigneeRole: "Incident Responder",
      team: "Security Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "05 Oct 2026 · 12:15",
      urgency: "Medium",
    },
  },
  {
    id: "INC-2026-0141",
    title: "Suspicious activity near gate",
    category: "Security",
    location: "Maitama",
    priority: "Informational",
    status: "Broadcast",
    incidentType: "Emergency Report",
    reported: "05 Oct 2026 · 11:18",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "Two unidentified men have been observed photographing the north gate and staff entrance for about 30 minutes.",
    reporter: "Samuel Ekanem",
    reporterId: "STF-0002",
    department: "Abuja Operations",
    channel: "Phone call",
    floorArea: "Perimeter · North gate",
    watchers: 3,
    timeline: [
      { title: "Incident reported", detail: "Reported via phone call by Samuel Ekanem.", time: "05 Oct 2026 · 11:18" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "05 Oct 2026 · 11:28" },
      { title: "Responder assigned", detail: "Ibrahim Musa assigned by Mike Kanu (Risk Administrator) to handle the incident (Emergency Response).", time: "05 Oct 2026 · 11:29" },
      { title: "Incident broadcast", detail: "Shared with staff as an alert by Mike Kanu (Risk Administrator).", time: "05 Oct 2026 · 11:43" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Ibrahim Musa",
      assigneeId: "RSP-06",
      assigneeRole: "Operations Coordinator",
      team: "Emergency Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "05 Oct 2026 · 11:29",
      urgency: "Low",
    },
  },
  {
    id: "INC-2026-0140",
    title: "Power fluctuation in warehouse",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Under review",
    incidentType: "Emergency Report",
    reported: "05 Oct 2026 · 10:51",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "Lights and cold-room equipment in the warehouse are flickering repeatedly, suggesting an unstable power supply.",
    reporter: "Musa Kolo",
    reporterId: "STF-0016",
    department: "Facilities Department",
    channel: "Mobile app",
    floorArea: "Warehouse · Bay 2",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Musa Kolo.", time: "05 Oct 2026 · 10:51" },
      { title: "Review started", detail: "Under review by Mike Kanu (Risk Administrator).", time: "05 Oct 2026 · 10:59" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
  },
  {
    id: "INC-2026-0139",
    title: "Generator startup failure",
    category: "Facilities",
    location: "Kubwa",
    priority: "Critical",
    status: "Escalated",
    incidentType: "Emergency Report",
    reported: "05 Oct 2026 · 10:14",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "The standby generator failed to start during a scheduled test. The battery and fuel line have been checked without success.",
    reporter: "Aisha Mohammed",
    reporterId: "STF-0009",
    department: "Facilities Department",
    channel: "Mobile app",
    floorArea: "Generator house",
    watchers: 4,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Aisha Mohammed.", time: "05 Oct 2026 · 10:14" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "05 Oct 2026 · 10:24" },
      { title: "Responder assigned", detail: "Abbas Taofeeq assigned by Mike Kanu (Risk Administrator) to handle the incident (Security Response).", time: "05 Oct 2026 · 10:25" },
      { title: "Incident escalated", detail: "Escalated by Abbas Taofeeq (Incident Responder). A replacement starter motor is not available locally; Facilities management support is needed.", time: "05 Oct 2026 · 11:14" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Abbas Taofeeq",
      assigneeId: "RSP-03",
      assigneeRole: "Incident Responder",
      team: "Security Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "05 Oct 2026 · 10:25",
      urgency: "Critical",
      escalated: true,
      escalationReason: "A replacement starter motor is not available locally; Facilities management support is needed.",
      escalatedAt: "05 Oct 2026 · 11:14",
    },
  },
  {
    id: "INC-2026-0138",
    title: "Suspected phishing email reported",
    category: "Security",
    location: "Central Area",
    priority: "Informational",
    status: "Submitted",
    incidentType: "Emergency Report",
    reported: "05 Oct 2026 · 09:33",
    reviewStatus: "Not started",
    actionLabel: "Review",
    description: "Several staff received an email impersonating the payroll team asking them to confirm bank details through an external link.",
    reporter: "Chidi Okeke",
    reporterId: "STF-0010",
    department: "ICT Department",
    channel: "Web portal",
    floorArea: "Central Area · ICT helpdesk",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via web portal by Chidi Okeke.", time: "05 Oct 2026 · 09:33" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "05 Oct 2026 · 09:33" },
    ],
  },
  {
    id: "INC-2026-0137",
    title: "Air quality alarm in labs",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Under review",
    incidentType: "Emergency Report",
    reported: "04 Oct 2026 · 18:09",
    reviewStatus: "In progress",
    actionLabel: "Review",
    description: "The air quality monitor in the labs is alarming and two staff report headaches and dizziness. The area has been cleared.",
    reporter: "Funke Alade",
    reporterId: "STF-0011",
    department: "Medical Services",
    channel: "Mobile app",
    floorArea: "Research labs · Level 2",
    watchers: 3,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Funke Alade.", time: "04 Oct 2026 · 18:09" },
      { title: "Review started", detail: "Under review by Mike Kanu (Risk Administrator).", time: "04 Oct 2026 · 18:17" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
  },
  {
    id: "INC-2026-0136",
    title: "Roof leak near conference hall",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Submitted",
    incidentType: "Emergency Report",
    reported: "04 Oct 2026 · 17:42",
    reviewStatus: "Not started",
    actionLabel: "Review",
    description: "Rainwater is leaking through the ceiling next to the conference hall projector and wetting the carpet.",
    reporter: "Musa Kolo",
    reporterId: "STF-0016",
    department: "Facilities Department",
    channel: "Web portal",
    floorArea: "Conference hall · Roof",
    watchers: 1,
    timeline: [
      { title: "Incident reported", detail: "Reported via web portal by Musa Kolo.", time: "04 Oct 2026 · 17:42" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "04 Oct 2026 · 17:42" },
    ],
  },
  {
    id: "INC-2026-0135",
    title: "Vehicle access rejected at gate B",
    category: "Security",
    location: "Jabi",
    priority: "Informational",
    status: "Verified",
    incidentType: "Emergency Report",
    reported: "04 Oct 2026 · 17:05",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "A visitor vehicle was refused entry at gate B because of an expired access pass and the driver became abusive towards the guard.",
    reporter: "Yakubu Danladi",
    reporterId: "STF-0012",
    department: "Security Department",
    channel: "Mobile app",
    floorArea: "Gate B",
    watchers: 1,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Yakubu Danladi.", time: "04 Oct 2026 · 17:05" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "04 Oct 2026 · 17:15" },
      { title: "Responder assigned", detail: "Ibrahim Musa assigned by Mike Kanu (Risk Administrator) to handle the incident (Emergency Response).", time: "04 Oct 2026 · 17:16" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Ibrahim Musa",
      assigneeId: "RSP-06",
      assigneeRole: "Operations Coordinator",
      team: "Emergency Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "04 Oct 2026 · 17:16",
      urgency: "Low",
    },
  },
  {
    id: "INC-2026-0134",
    title: "Heat stress in loading dock",
    category: "Medical",
    location: "Lugbe",
    priority: "Critical",
    status: "Under review",
    incidentType: "Emergency Report",
    reported: "04 Oct 2026 · 16:28",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "Two loading staff felt faint in the afternoon heat and were moved to a shaded area. Water has been provided.",
    reporter: "Funke Alade",
    reporterId: "STF-0011",
    department: "Medical Services",
    channel: "Phone call",
    floorArea: "Loading dock",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via phone call by Funke Alade.", time: "04 Oct 2026 · 16:28" },
      { title: "Review started", detail: "Under review by Mike Kanu (Risk Administrator).", time: "04 Oct 2026 · 16:36" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
  },
  {
    id: "INC-2026-0133",
    title: "Warehouse fire alarm reset",
    category: "Fire & safety",
    location: "Abuja HQ",
    priority: "Critical",
    status: "Verified",
    incidentType: "Emergency Report",
    reported: "04 Oct 2026 · 15:58",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "The warehouse fire alarm triggered and was reset by the guard before the cause was confirmed.",
    reporter: "Peter Ofori",
    reporterId: "STF-0006",
    department: "Abuja Operations",
    channel: "Mobile app",
    floorArea: "Warehouse · Fire panel",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Peter Ofori.", time: "04 Oct 2026 · 15:58" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "04 Oct 2026 · 16:08" },
      { title: "Responder assigned", detail: "Amina Hassan assigned by Mike Kanu (Risk Administrator) to handle the incident (Emergency Response).", time: "04 Oct 2026 · 16:09" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Amina Hassan",
      assigneeId: "RSP-01",
      assigneeRole: "Fire Safety Officer",
      team: "Emergency Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "04 Oct 2026 · 16:09",
      urgency: "Critical",
    },
  },
  {
    id: "INC-2026-0132",
    title: "Visitor check-in terminal down",
    category: "Security",
    location: "Utako",
    priority: "Advisory",
    status: "Under review",
    incidentType: "Emergency Report",
    reported: "03 Oct 2026 · 15:17",
    reviewStatus: "In progress",
    actionLabel: "Review",
    description: "The visitor check-in terminal has been unresponsive since the morning, forcing manual registration.",
    reporter: "Samuel Ekanem",
    reporterId: "STF-0002",
    department: "Abuja Operations",
    channel: "Web portal",
    floorArea: "Visitor reception · Check-in desk",
    watchers: 1,
    timeline: [
      { title: "Incident reported", detail: "Reported via web portal by Samuel Ekanem.", time: "03 Oct 2026 · 15:17" },
      { title: "Review started", detail: "Under review by Mike Kanu (Risk Administrator).", time: "03 Oct 2026 · 15:25" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
  },
  {
    id: "INC-2026-0131",
    title: "Medication stock discrepancy",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Submitted",
    incidentType: "Emergency Report",
    reported: "03 Oct 2026 · 14:48",
    reviewStatus: "Not started",
    actionLabel: "Review",
    description: "A routine count found a mismatch between the recorded and actual stock of a controlled medication.",
    reporter: "Funke Alade",
    reporterId: "STF-0011",
    department: "Medical Services",
    channel: "Web portal",
    floorArea: "Clinic · Medication store",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via web portal by Funke Alade.", time: "03 Oct 2026 · 14:48" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "03 Oct 2026 · 14:48" },
    ],
  },
  {
    id: "INC-2026-0130",
    title: "Public address system outage",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Informational",
    status: "Broadcast",
    incidentType: "Emergency Report",
    reported: "03 Oct 2026 · 14:12",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "The public address system produced no sound during the morning announcement test in several zones.",
    reporter: "Peter Ofori",
    reporterId: "STF-0006",
    department: "Abuja Operations",
    channel: "Mobile app",
    floorArea: "Building-wide",
    watchers: 1,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Peter Ofori.", time: "03 Oct 2026 · 14:12" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "03 Oct 2026 · 14:22" },
      { title: "Responder assigned", detail: "Kola Adebayo assigned by Mike Kanu (Risk Administrator) to handle the incident (Facilities Response).", time: "03 Oct 2026 · 14:23" },
      { title: "Incident broadcast", detail: "Shared with staff as an alert by Mike Kanu (Risk Administrator).", time: "03 Oct 2026 · 14:37" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Kola Adebayo",
      assigneeId: "RSP-02",
      assigneeRole: "Facilities Engineer",
      team: "Facilities Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "03 Oct 2026 · 14:23",
      urgency: "Low",
    },
  },
  {
    id: "INC-2026-0129",
    title: "Security escort request delay",
    category: "Security",
    location: "Guzape",
    priority: "Critical",
    status: "Escalated",
    incidentType: "Emergency Report",
    reported: "03 Oct 2026 · 13:34",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "A requested security escort for a visiting executive arrived 40 minutes late, delaying the journey.",
    reporter: "Yakubu Danladi",
    reporterId: "STF-0012",
    department: "Security Department",
    channel: "Phone call",
    floorArea: "Guzape · Residential gate",
    watchers: 3,
    timeline: [
      { title: "Incident reported", detail: "Reported via phone call by Yakubu Danladi.", time: "03 Oct 2026 · 13:34" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "03 Oct 2026 · 13:44" },
      { title: "Responder assigned", detail: "Ibrahim Musa assigned by Mike Kanu (Risk Administrator) to handle the incident (Emergency Response).", time: "03 Oct 2026 · 13:45" },
      { title: "Incident escalated", detail: "Escalated by Ibrahim Musa (Operations Coordinator). The escort delay affected an executive movement; operations leadership needs to review the escort arrangement.", time: "03 Oct 2026 · 14:34" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Ibrahim Musa",
      assigneeId: "RSP-06",
      assigneeRole: "Operations Coordinator",
      team: "Emergency Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "03 Oct 2026 · 13:45",
      urgency: "Critical",
      escalated: true,
      escalationReason: "The escort delay affected an executive movement; operations leadership needs to review the escort arrangement.",
      escalatedAt: "03 Oct 2026 · 14:34",
    },
  },
  {
    id: "INC-2026-0128",
    title: "Water tank overflow alert",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Verified",
    incidentType: "Emergency Report",
    reported: "02 Oct 2026 · 12:41",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "The rooftop water tank is overflowing onto the staircase landing after the float valve stuck open.",
    reporter: "Aisha Mohammed",
    reporterId: "STF-0009",
    department: "Facilities Department",
    channel: "Mobile app",
    floorArea: "Roof · Water tank",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Aisha Mohammed.", time: "02 Oct 2026 · 12:41" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "02 Oct 2026 · 12:51" },
      { title: "Responder assigned", detail: "Kola Adebayo assigned by Mike Kanu (Risk Administrator) to handle the incident (Facilities Response).", time: "02 Oct 2026 · 12:52" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Kola Adebayo",
      assigneeId: "RSP-02",
      assigneeRole: "Facilities Engineer",
      team: "Facilities Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "02 Oct 2026 · 12:52",
      urgency: "Medium",
    },
  },
  {
    id: "INC-2026-0127",
    title: "Defective AED cabinet activated",
    category: "Medical",
    location: "Gwarinpa",
    priority: "Informational",
    status: "Submitted",
    incidentType: "Emergency Report",
    reported: "02 Oct 2026 · 11:55",
    reviewStatus: "Not started",
    actionLabel: "Review",
    description: "The AED cabinet alarm sounded without anyone opening the unit, and the status light shows a fault.",
    reporter: "Ngozi Adeyemi",
    reporterId: "STF-0007",
    department: "Lagos Operations",
    channel: "Mobile app",
    floorArea: "Gwarinpa annex · Reception",
    watchers: 1,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Ngozi Adeyemi.", time: "02 Oct 2026 · 11:55" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "02 Oct 2026 · 11:55" },
    ],
  },
  {
    id: "INC-2026-0126",
    title: "Breach alert at perimeter fence",
    category: "Security",
    location: "Abuja HQ",
    priority: "Critical",
    status: "Under review",
    incidentType: "Emergency Report",
    reported: "02 Oct 2026 · 11:09",
    reviewStatus: "Pending",
    actionLabel: "Review",
    description: "A section of the east perimeter fence appears to have been cut and the intruder alarm was triggered overnight.",
    reporter: "Samuel Ekanem",
    reporterId: "STF-0002",
    department: "Abuja Operations",
    channel: "Phone call",
    floorArea: "Perimeter · East fence",
    watchers: 3,
    timeline: [
      { title: "Incident reported", detail: "Reported via phone call by Samuel Ekanem.", time: "02 Oct 2026 · 11:09" },
      { title: "Review started", detail: "Under review by Mike Kanu (Risk Administrator).", time: "02 Oct 2026 · 11:17" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
  },
  {
    id: "INC-2026-0125",
    title: "Lift malfunction at east wing",
    category: "Facilities",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Submitted",
    incidentType: "Emergency Report",
    reported: "02 Oct 2026 · 10:52",
    reviewStatus: "Not started",
    actionLabel: "Review",
    description: "Lift 2 stopped between floors and the doors would not open for several minutes before the engineer reset it.",
    reporter: "Musa Kolo",
    reporterId: "STF-0016",
    department: "Facilities Department",
    channel: "Mobile app",
    floorArea: "East wing · Lift 2",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Musa Kolo.", time: "02 Oct 2026 · 10:52" },
      { title: "Awaiting administrator review", detail: "Incident is pending verification and assignment.", time: "02 Oct 2026 · 10:52" },
    ],
  },
  {
    id: "INC-2026-0124",
    title: "Staff first aid response deployed",
    category: "Medical",
    location: "Wuse",
    priority: "Informational",
    status: "Verified",
    incidentType: "Emergency Report",
    reported: "01 Oct 2026 · 09:08",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "A staff member fainted at their desk; a trained colleague provided first aid and the staff member recovered.",
    reporter: "Esther Olamide",
    reporterId: "STF-0015",
    department: "Human Resources",
    channel: "Mobile app",
    floorArea: "Wuse office · Open plan",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Esther Olamide.", time: "01 Oct 2026 · 09:08" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "01 Oct 2026 · 09:18" },
      { title: "Responder assigned", detail: "Samuel Okafor assigned by Mike Kanu (Risk Administrator) to handle the incident (Medical Response).", time: "01 Oct 2026 · 09:19" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Samuel Okafor",
      assigneeId: "RSP-04",
      assigneeRole: "Medical Officer",
      team: "Medical Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "01 Oct 2026 · 09:19",
      urgency: "Low",
    },
  },
  {
    id: "INC-2026-0123",
    title: "Staff member requested urgent assistance",
    category: "Medical",
    location: "Abuja HQ",
    priority: "Critical",
    status: "Resolved",
    incidentType: "SOS",
    reported: "25 Oct 2026 · 10:24",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "A staff member felt severe chest pain and pressed SOS from the reception area.",
    reporter: "Peter Ofori",
    reporterId: "STF-0006",
    department: "Abuja Operations",
    channel: "Mobile app",
    floorArea: "Ground floor · Reception",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Peter Ofori.", time: "25 Oct 2026 · 10:24" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "25 Oct 2026 · 10:34" },
      { title: "Responder assigned", detail: "Samuel Okafor assigned by Mike Kanu (Risk Administrator) to handle the incident (Medical Response).", time: "25 Oct 2026 · 10:35" },
      { title: "Incident resolved", detail: "Samuel Okafor (Medical Officer) recorded the resolution: Medical support attended and the staff member confirmed they were safe.", time: "25 Oct 2026 · 11:54" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Samuel Okafor",
      assigneeId: "RSP-04",
      assigneeRole: "Medical Officer",
      team: "Medical Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "25 Oct 2026 · 10:35",
      urgency: "Critical",
    },
    resolutionSummary: "Medical support attended and the staff member confirmed they were safe.",
    resolvedAt: "25 Oct 2026 · 11:54",
    resolvedBy: "Samuel Okafor (Medical Officer)",
  },
  {
    id: "INC-2026-0122",
    title: "Smoke alarm activated in records room",
    category: "Fire & safety",
    location: "Garki",
    priority: "Critical",
    status: "Resolved",
    incidentType: "Emergency Report",
    reported: "24 Oct 2026 · 15:42",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "The smoke alarm activated in the records room and the area was cleared while the source was checked.",
    reporter: "Tunde Bakare",
    reporterId: "STF-0008",
    department: "Abuja Operations",
    channel: "Mobile app",
    floorArea: "Records room",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Tunde Bakare.", time: "24 Oct 2026 · 15:42" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "24 Oct 2026 · 15:52" },
      { title: "Responder assigned", detail: "Amina Hassan assigned by Mike Kanu (Risk Administrator) to handle the incident (Emergency Response).", time: "24 Oct 2026 · 15:53" },
      { title: "Incident resolved", detail: "Amina Hassan (Fire Safety Officer) recorded the resolution: The area was checked and cleared; no fire or injury was found.", time: "24 Oct 2026 · 17:12" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Amina Hassan",
      assigneeId: "RSP-01",
      assigneeRole: "Fire Safety Officer",
      team: "Emergency Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "24 Oct 2026 · 15:53",
      urgency: "Critical",
    },
    resolutionSummary: "The area was checked and cleared; no fire or injury was found.",
    resolvedAt: "24 Oct 2026 · 17:12",
    resolvedBy: "Amina Hassan (Fire Safety Officer)",
  },
  {
    id: "INC-2026-0121",
    title: "Road access obstruction reported",
    category: "Operations",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Closed",
    incidentType: "Incident Report",
    reported: "23 Oct 2026 · 08:16",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "A broken-down truck blocked the access road and prevented vehicles from reaching the car park.",
    reporter: "Samuel Ekanem",
    reporterId: "STF-0002",
    department: "Abuja Operations",
    channel: "Phone call",
    floorArea: "Access road · Car park approach",
    watchers: 1,
    timeline: [
      { title: "Incident reported", detail: "Reported via phone call by Samuel Ekanem.", time: "23 Oct 2026 · 08:16" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "23 Oct 2026 · 08:26" },
      { title: "Responder assigned", detail: "Ibrahim Musa assigned by Mike Kanu (Risk Administrator) to handle the incident (Emergency Response).", time: "23 Oct 2026 · 08:27" },
      { title: "Incident resolved", detail: "Ibrahim Musa (Operations Coordinator) recorded the resolution: Access was restored and the report was closed.", time: "23 Oct 2026 · 09:46" },
      { title: "Incident closed", detail: "Closed by Mike Kanu (Risk Administrator).", time: "23 Oct 2026 · 12:16" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Ibrahim Musa",
      assigneeId: "RSP-06",
      assigneeRole: "Operations Coordinator",
      team: "Emergency Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "23 Oct 2026 · 08:27",
      urgency: "Medium",
    },
    resolutionSummary: "Access was restored and the report was closed.",
    resolvedAt: "23 Oct 2026 · 09:46",
    resolvedBy: "Ibrahim Musa (Operations Coordinator)",
    closedAt: "23 Oct 2026 · 12:16",
    closedBy: "Mike Kanu (Risk Administrator)",
  },
  {
    id: "INC-2026-0120",
    title: "Security assistance requested at visitor entrance",
    category: "Security",
    location: "Maitama",
    priority: "Critical",
    status: "Closed",
    incidentType: "SOS",
    reported: "22 Oct 2026 · 13:05",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "A visitor became aggressive at the entrance and the reporter pressed SOS to request security assistance.",
    reporter: "Samuel Ekanem",
    reporterId: "STF-0002",
    department: "Abuja Operations",
    channel: "Mobile app",
    floorArea: "Visitor entrance",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Samuel Ekanem.", time: "22 Oct 2026 · 13:05" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "22 Oct 2026 · 13:15" },
      { title: "Responder assigned", detail: "Ibrahim Musa assigned by Mike Kanu (Risk Administrator) to handle the incident (Emergency Response).", time: "22 Oct 2026 · 13:16" },
      { title: "Incident resolved", detail: "Ibrahim Musa (Operations Coordinator) recorded the resolution: Security staff attended and confirmed the area was safe.", time: "22 Oct 2026 · 14:35" },
      { title: "Incident closed", detail: "Closed by Mike Kanu (Risk Administrator).", time: "22 Oct 2026 · 17:05" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Ibrahim Musa",
      assigneeId: "RSP-06",
      assigneeRole: "Operations Coordinator",
      team: "Emergency Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "22 Oct 2026 · 13:16",
      urgency: "Critical",
    },
    resolutionSummary: "Security staff attended and confirmed the area was safe.",
    resolvedAt: "22 Oct 2026 · 14:35",
    resolvedBy: "Ibrahim Musa (Operations Coordinator)",
    closedAt: "22 Oct 2026 · 17:05",
    closedBy: "Mike Kanu (Risk Administrator)",
  },
  {
    id: "INC-2026-0119",
    title: "Emergency power interruption in facilities room",
    category: "Facilities",
    location: "Kubwa",
    priority: "Critical",
    status: "Resolved",
    incidentType: "Emergency Report",
    reported: "21 Oct 2026 · 17:31",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "Emergency power to the facilities room was interrupted during a switchover and recovered after about 15 minutes.",
    reporter: "Musa Kolo",
    reporterId: "STF-0016",
    department: "Facilities Department",
    channel: "Mobile app",
    floorArea: "Facilities room",
    watchers: 2,
    timeline: [
      { title: "Incident reported", detail: "Reported via mobile app by Musa Kolo.", time: "21 Oct 2026 · 17:31" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "21 Oct 2026 · 17:41" },
      { title: "Responder assigned", detail: "Kola Adebayo assigned by Mike Kanu (Risk Administrator) to handle the incident (Facilities Response).", time: "21 Oct 2026 · 17:42" },
      { title: "Incident resolved", detail: "Kola Adebayo (Facilities Engineer) recorded the resolution: Backup power was restored and normal operations resumed.", time: "21 Oct 2026 · 19:01" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Kola Adebayo",
      assigneeId: "RSP-02",
      assigneeRole: "Facilities Engineer",
      team: "Facilities Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "21 Oct 2026 · 17:42",
      urgency: "Critical",
    },
    resolutionSummary: "Backup power was restored and normal operations resumed.",
    resolvedAt: "21 Oct 2026 · 19:01",
    resolvedBy: "Kola Adebayo (Facilities Engineer)",
  },
  {
    id: "INC-2026-0118",
    title: "Network connection interruption",
    category: "ICT",
    location: "Abuja HQ",
    priority: "Advisory",
    status: "Closed",
    incidentType: "Incident Report",
    reported: "20 Oct 2026 · 11:09",
    reviewStatus: "Completed",
    actionLabel: "View",
    description: "Network connectivity dropped for staff on the second floor; the switch was restarted and service restored.",
    reporter: "Chidi Okeke",
    reporterId: "STF-0010",
    department: "ICT Department",
    channel: "Web portal",
    floorArea: "Server room · Network cabinet",
    watchers: 1,
    timeline: [
      { title: "Incident reported", detail: "Reported via web portal by Chidi Okeke.", time: "20 Oct 2026 · 11:09" },
      { title: "Incident verified", detail: "Verified by Mike Kanu (Risk Administrator) as part of responder assignment.", time: "20 Oct 2026 · 11:19" },
      { title: "Responder assigned", detail: "Ngozi Eze assigned by Mike Kanu (Risk Administrator) to handle the incident (ICT Response).", time: "20 Oct 2026 · 11:20" },
      { title: "Incident resolved", detail: "Ngozi Eze (ICT Infrastructure Lead) recorded the resolution: Network service was restored and the issue was closed.", time: "20 Oct 2026 · 12:39" },
      { title: "Incident closed", detail: "Closed by Mike Kanu (Risk Administrator).", time: "20 Oct 2026 · 15:09" },
    ],
    reviewer: "Mike Kanu (Risk Administrator)",
    assignment: {
      assignee: "Ngozi Eze",
      assigneeId: "RSP-05",
      assigneeRole: "ICT Infrastructure Lead",
      team: "ICT Response",
      note: "Please attend, confirm the situation and post progress updates.",
      assignedAt: "20 Oct 2026 · 11:20",
      urgency: "Medium",
    },
    resolutionSummary: "Network service was restored and the issue was closed.",
    resolvedAt: "20 Oct 2026 · 12:39",
    resolvedBy: "Ngozi Eze (ICT Infrastructure Lead)",
    closedAt: "20 Oct 2026 · 15:09",
    closedBy: "Mike Kanu (Risk Administrator)",
  },
];

// Canonical Security Feed records. The Security Feed page and the dashboard's
// Security Feed Activity panel both read this list (via the shared feed store),
// so their published/pinned counts and activity always agree. Prototype fixture
// data — local only, no backend. All items come from the Risk Administrator.
export const feeds: FeedItem[] = [
  {
    id: "FD-2124",
    title: "Road blockade reported on Abuja–Kaduna expressway",
    summary:
      "A road blockade has been reported on the Abuja–Kaduna expressway near Jere. Staff should avoid road travel on this route until it is cleared.",
    category: "Travel",
    status: "Draft",
    pinned: false,
    content:
      "A road blockade has been reported on the Abuja–Kaduna expressway near Jere, with traffic backed up in both directions. Staff should avoid road travel on this route until the blockade is confirmed cleared, use the rail service where travel is essential, and confirm movement plans with the transport desk before departing.",
    audience: "Abuja HQ staff",
    shareability: "Internal only",
    priority: "Critical",
    updatedAt: "2026-11-02T08:20:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2123",
    title: "Flash flooding alert for low-lying areas of Lagos Island",
    summary:
      "Heavy rainfall has caused flash flooding in low-lying parts of Lagos Island and Victoria Island. Expect road closures and delayed commutes.",
    category: "Safety",
    status: "Draft",
    pinned: false,
    content:
      "Flash flooding has been reported in low-lying parts of Lagos Island and Victoria Island following overnight rainfall. Several roads are impassable and commutes are significantly delayed. Do not drive or walk through flood water, allow extra travel time, and check in with your line manager if you cannot reach the office safely.",
    audience: "Lagos office staff",
    shareability: "Internal only",
    priority: "Advisory",
    updatedAt: "2026-11-02T06:45:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2122",
    title: "Planned labour union rally in Port Harcourt city centre",
    summary:
      "A labour union rally is planned in Port Harcourt city centre on Wednesday. Expect heavy crowds and possible road closures around the rally route.",
    category: "Security",
    status: "Draft",
    pinned: false,
    content:
      "A labour union rally is planned in Port Harcourt city centre on Wednesday, gathering from mid-morning. Expect heavy crowds and possible road closures along the rally route. Avoid the area where possible, do not engage with gatherings, and follow security desk guidance on office access for the day.",
    audience: "Port Harcourt staff",
    shareability: "Internal only",
    priority: "Advisory",
    updatedAt: "2026-11-01T17:10:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2121",
    title: "Rise in fake police checkpoint reports on intercity routes",
    summary:
      "Reports of unofficial checkpoints extorting motorists on intercity routes have increased. Travel only on approved routes and report any suspicious stops.",
    category: "Travel",
    status: "Draft",
    pinned: false,
    content:
      "There has been an increase in reports of unofficial checkpoints stopping and extorting motorists on intercity routes, particularly after dark. Travel only on approved routes and during daylight hours, keep vehicle doors locked, and report any suspicious stop to the security desk as soon as it is safe to do so.",
    audience: "All staff",
    shareability: "Internal only",
    priority: "Advisory",
    updatedAt: "2026-11-01T12:30:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2120",
    title: "Fuel scarcity causing long queues in Abuja and Kano",
    summary:
      "Fuel scarcity has led to long queues at filling stations in Abuja and Kano. Plan journeys in advance and avoid waiting in queues after dark.",
    category: "Operations",
    status: "Draft",
    pinned: false,
    content:
      "Fuel scarcity has been reported in Abuja and Kano, with long queues forming at filling stations and some stations closed. Plan essential journeys in advance, keep pool vehicles fuelled where possible, and avoid waiting in queues after dark. Contact the transport desk if fuel shortages affect a planned trip.",
    audience: "General NSIA Group",
    shareability: "Internal only",
    priority: "Informational",
    updatedAt: "2026-10-31T15:05:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2119",
    title: "Cholera cases reported in parts of Kano State",
    summary:
      "Health authorities have confirmed cholera cases in parts of Kano State. Drink only treated water and report symptoms to Medical Services promptly.",
    category: "Medical",
    status: "Draft",
    pinned: false,
    content:
      "Confirmed cholera cases have been reported in parts of Kano State. Drink only bottled or treated water, wash hands frequently, and avoid uncooked street food. Staff with symptoms such as sudden diarrhoea or vomiting should contact Medical Services immediately and should not report to the office.",
    audience: "Kano office staff",
    shareability: "Internal only",
    priority: "Advisory",
    updatedAt: "2026-10-31T09:40:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2118",
    title: "Power grid disruption expected across northern states",
    summary:
      "A national grid disruption is expected to cause extended power outages across northern states. Offices should prepare backup power arrangements.",
    category: "Facilities",
    status: "Draft",
    pinned: false,
    content:
      "A national grid disruption is expected that may cause extended power outages across northern states over the coming days. Facilities teams should confirm generator fuel levels and test backup power. Staff should save work regularly and report any loss of critical systems to ICT Operations.",
    audience: "Operations staff",
    shareability: "Internal only",
    priority: "Informational",
    updatedAt: "2026-10-30T13:20:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2117",
    title: "Increase in mobile phone snatching around Wuse Market",
    summary:
      "Reports of mobile phone snatching by motorcycle riders around Wuse Market have increased. Keep phones out of sight when walking near busy roads.",
    category: "Security",
    status: "Draft",
    pinned: false,
    content:
      "An increase in mobile phone snatching by motorcycle riders has been reported around Wuse Market and nearby roads. Keep phones and valuables out of sight when walking near busy roads, avoid using your phone at the roadside, and report any incident to the security desk and the police.",
    audience: "Abuja HQ staff",
    shareability: "Internal only",
    priority: "Informational",
    updatedAt: "2026-10-29T10:15:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2116",
    title: "Updated emergency contact numbers for all offices",
    summary:
      "The security desk has updated the emergency contact numbers for all offices. Save the new numbers and remove any old ones from your phone.",
    category: "Security",
    status: "Published",
    pinned: false,
    content:
      "The security desk has updated the emergency contact numbers for all offices. Save the new numbers from the staff directory and remove any old numbers from your phone. The security desk line remains available around the clock for any emergency or suspicious activity.",
    audience: "All staff",
    shareability: "Internal only",
    publishedAt: "2026-10-28T09:00:00Z",
    updatedAt: "2026-10-28T09:00:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "FD-2115",
    title: "Fire warden refresher training schedule",
    summary:
      "Draft schedule for the next round of fire warden refresher training. Pending confirmation of dates with each office before publishing.",
    category: "Fire & safety",
    status: "Draft",
    pinned: false,
    content:
      "Draft schedule for the next round of fire warden refresher training across all offices. Each session covers evacuation routes, assembly points and extinguisher use. Dates are still to be confirmed with each office, so this item has not been published.",
    audience: "All staff",
    shareability: "Internal only",
    updatedAt: "2026-10-27T14:30:00Z",
    createdBy: "Mike Kanu",
  },
  {
    id: "FD-2114",
    title: "Phishing campaign impersonating internal IT",
    summary:
      "An active phishing campaign is impersonating the internal IT service desk. Do not open unexpected credential-reset links; report suspected messages to the security desk.",
    category: "Security",
    status: "Published",
    pinned: true,
    content:
      "The internal IT service desk has reported a phishing campaign using look-alike sender addresses and a fake credential-reset landing page. Do not open unexpected password-reset links or attachments — the service desk will never ask for your password by email. Report suspected messages with the Report Phishing action, and contact the security desk immediately if you have already entered credentials.",
    audience: "All staff",
    shareability: "Internal only",
    priority: "Critical",
    publishedAt: "2026-10-16T09:30:00Z",
    updatedAt: "2026-10-16T09:30:00Z",
    publishedBy: "Mike Kanu",
    history: [
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
      "Protest activity is planned near the Kano office corridor this week. Avoid non-essential travel and follow transport guidance.",
    category: "Travel",
    status: "Published",
    pinned: true,
    content:
      "Protest activity is planned near the Kano office corridor this week, with possible road closures and transport delays. Avoid non-essential travel along the affected routes, follow marshal guidance, and confirm your route with the transport desk before departing. Report any disruption to the security desk.",
    audience: "Kano office staff",
    shareability: "Internal only",
    priority: "Advisory",
    publishedAt: "2026-10-16T07:55:00Z",
    updatedAt: "2026-10-16T08:05:00Z",
    publishedBy: "Mike Kanu",
    history: [
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
      "Heavy rainfall and localised flooding risk are forecast. Staff should plan travel accordingly and allow additional time.",
    category: "Travel",
    status: "Published",
    pinned: false,
    content:
      "Heavy rainfall and localised flooding risk are forecast in the Lagos region over the coming days. Plan travel accordingly, allow additional time, and avoid routes prone to flooding. Report any travel disruption or safety concern to the security desk.",
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
      "A critical patch is available for perimeter security appliances. ICT Operations is scheduling the update; no action is required from staff.",
    category: "ICT",
    status: "Published",
    pinned: true,
    content:
      "A critical patch is available for the perimeter security appliances. ICT Operations is scheduling the update during the next maintenance window. No action is required from staff; the expected interruption to external services is under ten minutes.",
    audience: "ICT Operations",
    shareability: "Internal only",
    priority: "Critical",
    publishedAt: "2026-10-13T12:45:00Z",
    updatedAt: "2026-10-13T13:10:00Z",
    publishedBy: "Mike Kanu",
    history: [
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
    publishedAt: "2026-10-12T07:30:00Z",
    updatedAt: "2026-10-12T07:30:00Z",
    publishedBy: "Mike Kanu",
  },
  {
    id: "FD-2102",
    title: "Regional travel advisory (superseded)",
    summary:
      "Superseded regional travel advisory. Withdrawn and replaced by a refreshed advisory.",
    category: "Travel",
    status: "Withdrawn",
    pinned: false,
    publishedAt: "2026-10-08T09:00:00Z",
    updatedAt: "2026-10-11T15:40:00Z",
    publishedBy: "Mike Kanu",
    history: [
      { title: "Item published", detail: "Published to the Security Feed by Mike Kanu.", time: "08 Oct 2026 · 09:00" },
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
    publishedAt: "2026-10-03T08:00:00Z",
    updatedAt: "2026-10-06T09:00:00Z",
    publishedBy: "Mike Kanu",
  },
];
