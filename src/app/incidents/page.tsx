import { requireRiskAdministrator } from "../auth/role-access";
import IncidentQueuePage from "./incident-queue";

// Role guards redirect during render, which instant-navigation validation cannot render past.
export const instant = false;

export default async function IncidentsPage() {
  await requireRiskAdministrator("/responder/incidents");
  return <IncidentQueuePage />;
}
