import DashboardPage from "./dashboard/page";
import { redirect } from "next/navigation";
import {
  getSessionUser,
} from "./auth/role-access";
import {
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  RISK_ADMINISTRATOR,
  SYSTEM_ADMINISTRATOR,
} from "./auth/current-user";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user.role === INCIDENT_RESPONDER) redirect("/responder/dashboard");
  if (user.role === MANAGEMENT_USER) redirect("/management/dashboard");
  if (user.role === SYSTEM_ADMINISTRATOR) redirect("/system-admin/dashboard");
  if (user.role !== RISK_ADMINISTRATOR) redirect("/responder/dashboard");
  return <DashboardPage />;
}
