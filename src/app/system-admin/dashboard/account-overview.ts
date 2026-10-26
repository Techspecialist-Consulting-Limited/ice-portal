import {
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  RISK_ADMINISTRATOR,
  SYSTEM_ADMINISTRATOR,
} from "../../auth/current-user";

export const PORTAL_ACCOUNT_OVERVIEW = {
  total: 18,
  active: 16,
  suspended: 2,
  roleCount: 4,
} as const;

export const ROLE_ACCOUNT_COUNTS = [
  { role: RISK_ADMINISTRATOR, count: 5 },
  { role: INCIDENT_RESPONDER, count: 6 },
  { role: MANAGEMENT_USER, count: 4 },
  { role: SYSTEM_ADMINISTRATOR, count: 3 },
] as const;
