import type { ReactNode } from "react";
import { requireRiskAdministrator } from "../auth/role-access";

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requireRiskAdministrator("/responder/dashboard");
  return children;
}
