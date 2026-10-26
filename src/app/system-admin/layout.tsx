import type { ReactNode } from "react";
import { requireSystemAdministrator } from "../auth/role-access";

export default async function SystemAdminLayout({ children }: { children: ReactNode }) {
  await requireSystemAdministrator("/");
  return children;
}
