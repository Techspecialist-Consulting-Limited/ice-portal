import { CURRENT_USER, INCIDENT_RESPONDER, type CurrentUser } from "../auth/current-user";
import type { IncidentItem } from "../dashboard/mock-data";

export function canResponderAccessIncident(
  incident: IncidentItem,
  user: CurrentUser = CURRENT_USER,
): boolean {
  return user.role === INCIDENT_RESPONDER
    && Boolean(user.id && incident.assignment?.assigneeId === user.id);
}
