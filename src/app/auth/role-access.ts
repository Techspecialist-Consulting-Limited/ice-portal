import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getUserById,
  homePathForRole,
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  RISK_ADMINISTRATOR,
  SESSION_USER_COOKIE,
  SYSTEM_ADMINISTRATOR,
} from "./current-user";

export async function getSessionUser() {
  const cookieStore = await cookies();
  return getUserById(cookieStore.get(SESSION_USER_COOKIE)?.value);
}

// Each guard sends a user without the required role to `destination` when one
// is given, otherwise to their own role's landing page. Never to "/", which is
// the sign-in page.
export async function requireRiskAdministrator(destination?: string): Promise<void> {
  const user = await getSessionUser();
  if (user.role !== RISK_ADMINISTRATOR) redirect(destination ?? homePathForRole(user.role));
}

export async function requireIncidentResponder(destination?: string): Promise<void> {
  const user = await getSessionUser();
  if (user.role !== INCIDENT_RESPONDER) redirect(destination ?? homePathForRole(user.role));
}

export async function requireManagementUser(destination?: string): Promise<void> {
  const user = await getSessionUser();
  if (user.role !== MANAGEMENT_USER) redirect(destination ?? homePathForRole(user.role));
}

export async function requireSystemAdministrator(destination?: string): Promise<void> {
  const user = await getSessionUser();
  if (user.role !== SYSTEM_ADMINISTRATOR) redirect(destination ?? homePathForRole(user.role));
}
