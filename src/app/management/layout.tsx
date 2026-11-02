import type { ReactNode } from "react";
import { requireManagementUser } from "../auth/role-access";

// Role guards redirect during render, which instant-navigation validation cannot render past.
export const instant = false;

export default async function ManagementLayout({ children }: { children: ReactNode }) {
  await requireManagementUser();
  return children;
}
