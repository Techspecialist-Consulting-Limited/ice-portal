import type { ReactNode } from "react";
import { requireIncidentResponder } from "../auth/role-access";

// Role guards redirect during render, which instant-navigation validation cannot render past.
export const instant = false;

export default async function ResponderLayout({ children }: { children: ReactNode }) {
  await requireIncidentResponder();
  return children;
}
