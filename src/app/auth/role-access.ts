import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getUserById,
  INCIDENT_RESPONDER,
  RISK_ADMINISTRATOR,
  SESSION_USER_COOKIE,
} from "./current-user";

export async function getSessionUser() {
  const cookieStore = await cookies();
  return getUserById(cookieStore.get(SESSION_USER_COOKIE)?.value);
}

export async function requireRiskAdministrator(destination: string): Promise<void> {
  const user = await getSessionUser();
  if (user.role !== RISK_ADMINISTRATOR) redirect(destination);
}

export async function requireIncidentResponder(destination: string): Promise<void> {
  const user = await getSessionUser();
  if (user.role !== INCIDENT_RESPONDER) redirect(destination);
}
