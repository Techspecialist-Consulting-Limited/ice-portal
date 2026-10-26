import type { ReactNode } from "react";
import { requireManagementUser } from "../auth/role-access";

export default async function ManagementLayout({ children }: { children: ReactNode }) {
  await requireManagementUser("/");
  return children;
}
