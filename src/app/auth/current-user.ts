// The authenticated identity for the current session, in one place.
//
// This repository does not yet implement an authentication layer: there is no
// sign-in flow, no session store, no middleware and no directory/Active
// Directory connector. Identity is instead represented here as a single,
// typed record that every surface reads from — the sidebar, the header and the
// Profile page — so the signed-in name and role can never drift apart or be
// hard-coded twice.
//
// When a real identity provider is connected, `CURRENT_USER` is the single
// value to replace with the session's user; the shape below is the contract the
// rest of the portal depends on. Until then treat it as a development fixture,
// not evidence of a live directory connection.

// Canonical role strings. Every guard and audit label compares against these
// constants, so a role can only be renamed in one place and cannot drift into
// a mismatched literal elsewhere.
export type UserRole = "Risk Administrator" | "Incident Responder";

export const RISK_ADMINISTRATOR: UserRole = "Risk Administrator";
export const INCIDENT_RESPONDER: UserRole = "Incident Responder";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  /** Assigned access role; always one of the canonical `UserRole` values. */
  role: UserRole;
  /** Organizational attributes; optional because the directory owns them. */
  department?: string;
  businessUnit?: string;
  officeLocation?: string;
  employeeId?: string;
  /** ISO timestamp of the most recent sign-in. */
  lastLoginAt?: string;
  /** Profile photo. When absent the UI renders initials derived from `name`. */
  avatarUrl?: string;
  /** Directory-provided account status, when the source actually has one. */
  status?: string;
};

// Neutral fallbacks. Unknown values are always shown with one of these rather
// than an empty row or a fabricated value.
export const PROFILE_NOT_AVAILABLE = "Not available";
export const PROFILE_NOT_PROVIDED = "Not provided";

// The portal's two identities, as complete records. Both users live here so
// that switching the signed-in user never means editing a record in place —
// which is how the roles previously got mixed up (a responder test session
// overwrote the administrator fixture, and audit trails then stamped
// "(Risk Administrator)" next to the responder's name).
export const USERS = {
  mikeKanu: {
    id: "USR-0001",
    name: "Mike Kanu",
    email: "mike.kanu@nsia.com",
    role: RISK_ADMINISTRATOR,
    department: "Risk & Compliance",
    // No lastLoginAt, no status: unknown rather than made up.
  },
  abbasTaofeeq: {
    id: "RSP-03",
    name: "Abbas Taofeeq",
    email: PROFILE_NOT_PROVIDED,
    role: INCIDENT_RESPONDER,
  },
} as const satisfies Record<string, CurrentUser>;

// Default identity for a fresh browser. The profile-name role switcher stores
// a selected user ID in a cookie so the server and client resolve the same
// identity on subsequent requests.
const SESSION_USER_ID = USERS.mikeKanu.id;

export const CURRENT_USER: CurrentUser =
  Object.values(USERS).find((user) => user.id === SESSION_USER_ID) ?? USERS.mikeKanu;

export const SESSION_USER_COOKIE = "ice-portal-user";

export function getUserById(id: string | undefined): CurrentUser {
  return Object.values(USERS).find((user) => user.id === id) ?? CURRENT_USER;
}

// Safe initials for the avatar fallback. Handles one word, several words and
// empty/missing names without throwing or producing an empty badge.
export function initialsFromName(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

// Audit actor labels ("Mike Kanu (Risk Administrator)") are built from this one
// source, so recorded action history can never disagree with the signed-in
// identity, and pages cannot hard-code their own copy of it.
export function currentActorLabel(): string {
  const userId = typeof document === "undefined"
    ? undefined
    : document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${SESSION_USER_COOKIE}=`))
      ?.slice(SESSION_USER_COOKIE.length + 1);
  const user = getUserById(userId);
  return `${user.name} (${user.role})`;
}
