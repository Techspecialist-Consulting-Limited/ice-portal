import type { ReactNode } from "react";
import { requireIncidentResponder } from "../auth/role-access";

export default async function ResponderLayout({ children }: { children: ReactNode }) {
  await requireIncidentResponder("/");
  return children;
}
