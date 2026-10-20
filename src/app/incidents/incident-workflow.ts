import type { IncidentStatus } from "../dashboard/mock-data";

export function escalationBlockReason(status: IncidentStatus): string | null {
  if (status === "Escalated") return "This incident is already escalated.";
  if (status === "Broadcast") return "Escalation is not available once an incident has been broadcast.";
  if (status === "Rejected") return "Escalation is not available for a rejected report.";
  if (status === "Resolved" || status === "Closed") return "Escalation is not available for a resolved or closed incident.";
  return null;
}
