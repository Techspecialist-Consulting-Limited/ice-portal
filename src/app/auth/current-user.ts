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

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  /** Assigned access role, e.g. "Risk Administrator". */
  role: string;
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

// Development fixture for the current session's identity. The department is
// consistent with the existing "Risk & Compliance" risk-register owner already
// used by the Security Feed sources. `lastLoginAt` is deliberately absent: the
// prototype has no login/session tracking, so no sign-in time is known and none
// is invented.
export const CURRENT_USER: CurrentUser = {
  id: "USR-0001",
  name: "Mike Kanu",
  email: "mike.kanu@nsia.com",
  role: "Risk Administrator",
  department: "Risk & Compliance",
  // No lastLoginAt, no status: unknown rather than made up.
};

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
  return `${CURRENT_USER.name} (${CURRENT_USER.role})`;
}
