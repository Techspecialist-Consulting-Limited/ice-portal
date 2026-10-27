"use client";

import { useState } from "react";
import { useCurrentUser } from "./current-user-provider";
import {
  INCIDENT_RESPONDER,
  MANAGEMENT_USER,
  SYSTEM_ADMINISTRATOR,
  USERS,
  type CurrentUser,
} from "./current-user";

const switchableUsers = Object.values(USERS) as CurrentUser[];

export function SessionRoleSwitcher() {
  const currentUser = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function switchUser(user: CurrentUser) {
    setError("");
    try {
      const response = await fetch("/api/session/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!response.ok) throw new Error(`Role switch failed (${response.status}).`);
      const destination = user.role === INCIDENT_RESPONDER
        ? "/responder/dashboard"
        : user.role === MANAGEMENT_USER
          ? "/management/dashboard"
          : user.role === SYSTEM_ADMINISTRATOR
            ? "/system-admin/dashboard"
          : "/";
      window.location.assign(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the active role.");
    }
  }

  return (
    <div className="relative mt-5">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[12px] font-semibold text-[var(--primary)]">
          {currentUser.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold leading-[17px] text-[var(--foreground)]">{currentUser.name}</span>
          <span className="block truncate text-[11px] leading-[16px] text-[var(--muted-foreground)]">{currentUser.role}</span>
        </span>
        <span aria-hidden="true" className="text-[12px] text-[var(--muted-foreground)]">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div role="menu" aria-label="Switch user role" className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] p-1.5 shadow-lg">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Switch role</p>
          {switchableUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              role="menuitem"
              disabled={user.id === currentUser.id}
              onClick={() => void switchUser(user)}
              className="block w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--muted)] disabled:cursor-default disabled:bg-[var(--muted)]"
            >
              <span className="block truncate text-[12px] font-semibold text-[var(--foreground)]">{user.name}</span>
              <span className="block truncate text-[11px] text-[var(--muted-foreground)]">{user.role}</span>
            </button>
          ))}
          {error && <p role="alert" className="px-2 py-1.5 text-[11px] text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
