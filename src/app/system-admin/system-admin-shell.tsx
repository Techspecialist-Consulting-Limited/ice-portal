"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { History, KeyRound, LayoutDashboard, LogOut, Menu, Search, Settings2, ShieldCheck, UsersRound, X, HelpCircle, ChevronDown, Home } from "lucide-react";
import { SessionRoleSwitcher } from "../auth/session-role-switcher";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/system-admin/dashboard" },
  { label: "Portal users", icon: UsersRound, href: "/system-admin/users" },
  { label: "Roles & access", icon: KeyRound, href: "/system-admin/roles" },
  { label: "Custom roles", icon: KeyRound, href: "/system-admin/custom-roles" },
  { label: "Organization settings", icon: Settings2, href: "/system-admin/settings" },
  { label: "Activity log", icon: History, href: "/system-admin/activity" },
] as const;

export function SystemAdminShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  const getBreadcrumbLabel = () => {
    if (pathname === "/system-admin/dashboard") return "Dashboard";
    if (pathname === "/system-admin/users") return "Portal users";
    if (pathname === "/system-admin/roles") return "Roles & access";
    if (pathname === "/system-admin/custom-roles") return "Custom roles";
    if (pathname === "/system-admin/settings") return "Organization settings";
    if (pathname === "/system-admin/activity") return "Activity log";
    return "";
  };

  return (
    <main className="h-dvh w-full overflow-hidden bg-[var(--page-bg)] text-[var(--foreground)]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[285px] flex-col border-r border-[var(--border)] bg-[var(--panel)] transition-transform md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-4 py-4">
          <Image
            src="/evidence/ice-logo-removed-bg.png"
            alt="ICE 2.0 logo"
            width={64}
            height={64}
            className="h-9 w-9 shrink-0 object-contain"
          />
          <span>
            <span className="block text-[12px] font-semibold tracking-[0.02em] text-[var(--primary)]">ICE 2.0</span>
            <span className="block text-[10px] text-[var(--muted-foreground)]">Incident Management Portal</span>
          </span>
        </div>

        <div className="px-3 pt-3">
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Current workspace</p>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1.5">
            <span className="block truncate text-[11px] font-medium leading-4 text-[var(--muted-foreground)]">System Administrator</span>
          </div>
        </div>

        <nav aria-label="System administration navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {navigation.map(({ label, icon: Icon, href }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={label}
                href={href}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMobileNavOpen(false)}
                className={`mb-2 flex h-11 items-center gap-2.5 rounded-xl px-3 text-[13px] font-medium transition-colors relative ${
                  isActive
                    ? "bg-[var(--primary-soft)] text-[var(--foreground)]"
                    : "text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {isActive && <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[var(--primary)]" aria-hidden="true" />}
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <footer className="mt-auto shrink-0 px-4 pb-5 pt-6">
          <div className="flex min-h-[58px] items-center gap-3 rounded-xl bg-[var(--muted)] px-3.5 py-3">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--primary)]" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold leading-[17px] text-[var(--foreground)]">Administration</span>
              <span className="block text-[11px] leading-[16px] text-[var(--muted-foreground)]">Portal access overview</span>
            </span>
          </div>

          <SessionRoleSwitcher />

          <button type="button" disabled title="Sign out is not available yet." className="mt-3 flex min-h-8 w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-[var(--muted-foreground)] opacity-70 hover:bg-[var(--muted)]">
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

      <div className="flex h-dvh min-w-0 flex-col overflow-hidden md:ml-[285px]">
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
          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2">
            <Home className="h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
            <span className="text-[12px] text-[var(--muted-foreground)]">Portal administration</span>
            <ChevronDown className="h-3 w-3.5 -rotate-90 text-[var(--muted-foreground)]" aria-hidden="true" />
            <span className="text-[12px] font-medium text-[var(--primary)]">{getBreadcrumbLabel()}</span>
          </nav>
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-3">
            <label className="relative">
              <span className="sr-only">Search users, roles or settings</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search users, roles or settings…"
                className="h-9 w-64 rounded-lg border border-[var(--input)] bg-[var(--card)] pl-9 pr-3 text-[12px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              />
            </label>
            <button type="button" aria-label="Help" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="h-6 w-px bg-[var(--border)]" />
            <button type="button" aria-label="User menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <span className="text-[11px] font-semibold">SO</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[var(--background)]">
          <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6 lg:py-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
