"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardList,
  FileBarChart,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  RadioTower,
  ShieldCheck,
  X,
} from "lucide-react";
import { SessionRoleSwitcher } from "../auth/session-role-switcher";

const navigation = [
  { label: "Executive dashboard", icon: LayoutDashboard, href: "/management/dashboard" },
  { label: "Incident analytics", icon: ClipboardList, href: "/management/incidents" },
  { label: "Alert analytics", icon: RadioTower, href: "/management/alerts" },
  { label: "Trends & readiness", icon: Activity, href: "/management/readiness" },
  { label: "Executive reports", icon: FileBarChart, href: "/management/reports" },
] as const;

export function ManagementShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  return (
    <main className="h-dvh w-full overflow-hidden bg-[var(--page-bg)] text-[var(--foreground)]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-[var(--border)] bg-[var(--panel)] transition-transform md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[var(--primary-soft)] text-[var(--primary)] ring-1 ring-[var(--border)]">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[12px] font-semibold tracking-[0.02em] text-[var(--primary)]">ICE 2.0</span>
            <span className="block text-[10px] text-[var(--muted-foreground)]">NSIA · In Case of Emergency</span>
          </span>
        </div>

        <div className="px-3 pt-3">
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Current workspace</p>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1.5">
            <span className="block truncate text-[11px] font-medium leading-4 text-[var(--muted-foreground)]">Management User</span>
          </div>
        </div>

        <nav aria-label="Management navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {navigation.map(({ label, icon: Icon, ...item }) => {
            return (
              <Link
                key={label}
                href={item.href}
                aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "page" : undefined}
                onClick={() => setMobileNavOpen(false)}
                className={`mb-2 flex h-11 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium transition-colors ${
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "bg-[var(--primary-soft)] text-[var(--foreground)]"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <footer className="mt-auto shrink-0 px-4 pb-5 pt-6">
          <Link
            href="/support"
            className="flex min-h-[58px] items-center gap-3 rounded-xl bg-[var(--muted)] px-3.5 py-3 transition-colors hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Headset aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold leading-[17px] text-[var(--foreground)]">Need help?</span>
              <span className="block text-[11px] leading-[16px] text-[var(--muted-foreground)]">Contact ICT Support</span>
            </span>
          </Link>

          <SessionRoleSwitcher />

          <button type="button" disabled title="Sign out is not available yet." className="mt-3 flex min-h-8 w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-[var(--muted-foreground)] opacity-70">
            <LogOut aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <span>Sign out</span>
          </button>
        </footer>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}

      <div className="flex h-dvh min-w-0 flex-col overflow-hidden md:ml-[250px]">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-3 py-3 sm:px-4 lg:px-6">
          <button
            type="button"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] md:hidden"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <p className="truncate text-[13px] font-medium text-[var(--muted-foreground)]">Executive oversight</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[var(--background)]">
          <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6 lg:py-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
