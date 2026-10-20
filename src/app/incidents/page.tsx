import { requireRiskAdministrator } from "../auth/role-access";
import IncidentQueuePage from "./incident-queue";

export default async function IncidentsPage() {
  await requireRiskAdministrator("/responder/incidents");
  return <IncidentQueuePage />;
}
