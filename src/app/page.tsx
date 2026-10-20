import DashboardPage from "./dashboard/page";
import { requireRiskAdministrator } from "./auth/role-access";

export default async function HomePage() {
  await requireRiskAdministrator("/responder/dashboard");
  return <DashboardPage />;
}
