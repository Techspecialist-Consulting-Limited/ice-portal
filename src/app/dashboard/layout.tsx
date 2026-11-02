import type { ReactNode } from "react";
import { requireRiskAdministrator } from "../auth/role-access";

// Role guards redirect during render, which instant-navigation validation cannot render past.
export const instant = false;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireRiskAdministrator();
  return children;
}
