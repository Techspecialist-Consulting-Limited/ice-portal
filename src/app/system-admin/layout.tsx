import type { ReactNode } from "react";
import { requireSystemAdministrator } from "../auth/role-access";

// Role guards redirect during render, which instant-navigation validation cannot render past.
export const instant = false;

export default async function SystemAdminLayout({ children }: { children: ReactNode }) {
  await requireSystemAdministrator();
  return children;
}
