"use client";

import Link from "next/link";
import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  ChartNoAxesCombined,
  ClipboardList,
  ExternalLink,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  RadioTower,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useCurrentUser } from "../auth/current-user-provider";
import { SessionRoleSwitcher } from "../auth/session-role-switcher";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "../alerts/alert-state";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "./incident-state";
import {
  getFeedStateServerSnapshot,
  getFeedStateSnapshot,
  subscribeToFeedState,
} from "../security-feed/feed-state";

export type PortalNavKey = "dashboard" | "incidents" | "alerts" | "security-feed" | "reports" | "profile";

const navItems: Array<{ key: PortalNavKey; label: string; href: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { key: "incidents", label: "Incidents", href: "/incidents", icon: ClipboardList },
  { key: "alerts", label: "Alerts", href: "/alerts", icon: Bell },
  { key: "security-feed", label: "Security Feed", href: "/security-feed", icon: RadioTower },
  { key: "reports", label: "Reports", href: "/reports", icon: ChartNoAxesCombined },
  { key: "profile", label: "Profile", href: "/profile", icon: UserRound },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type GlobalSearchResult = {
  id: string;
  title: string;
  detail: string;
  type: "Incident" | "Alert" | "Security feed";
  href: string;
};

function PortalSearchFallback() {
  return (
    <div className="mx-auto flex h-10 w-full min-w-0 items-center rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 md:max-w-[560px]">
      <span className="text-sm text-[var(--muted-foreground)]">Search incidents, alerts, and feed...</span>
    </div>
  );
}

function PortalSearchField() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() =>
    ["/incidents", "/alerts", "/security-feed"].includes(pathname)
      ? searchParams.get("search") ?? ""
      : "",
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchResult, setActiveSearchResult] = useState(0);
  const incidents = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  );
  const alerts = useSyncExternalStore(
    subscribeToAlertState,
    getAlertStateSnapshot,
    getAlertStateServerSnapshot,
  );
  const feedItems = useSyncExternalStore(
    subscribeToFeedState,
    getFeedStateSnapshot,
    getFeedStateServerSnapshot,
  );
  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    if (term.length < 2) return [];

    const matches: GlobalSearchResult[] = [
      ...incidents
        .filter((item) =>
          `${item.id} ${item.title} ${item.description ?? ""} ${item.category} ${item.location} ${item.status} ${item.reporter ?? ""} ${item.department ?? ""}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((item) => ({
          id: item.id,
          title: item.title,
          detail: `${item.id} · ${item.category} · ${item.status}`,
          type: "Incident" as const,
          href: `/incidents/${encodeURIComponent(item.id)}`,
        })),
      ...alerts
        .filter((item) =>
          `${item.id} ${item.title} ${item.summary ?? ""} ${item.category} ${item.location} ${item.priority} ${item.status} ${item.audience}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((item) => ({
          id: item.id,
          title: item.title,
          detail: `${item.id} · ${item.category} · ${item.status}`,
          type: "Alert" as const,
          href: `/alerts/${encodeURIComponent(item.id)}`,
        })),
      ...feedItems
        .filter((item) =>
          `${item.id} ${item.title} ${item.summary ?? ""} ${item.content ?? ""} ${item.category} ${item.source} ${item.status}`
            .toLocaleLowerCase()
            .includes(term),
        )
        .map((item) => ({
          id: item.id,
          title: item.title,
          detail: `${item.id} · ${item.category} · ${item.status}`,
          type: "Security feed" as const,
          href: `/security-feed/${encodeURIComponent(item.id)}`,
        })),
    ];

    return matches.slice(0, 8);
  }, [alerts, feedItems, incidents, searchTerm]);

  const openSearchResult = (result: GlobalSearchResult) => {
    setSearchOpen(false);
    setSearchTerm("");
    router.push(result.href);
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = searchResults[activeSearchResult] ?? searchResults[0];
    if (result) {
      openSearchResult(result);
      return;
    }

    const term = searchTerm.trim();
    if (term) router.push(`/incidents?search=${encodeURIComponent(term)}`);
  };

  return (
    <form
      className="relative mx-auto flex min-w-0 flex-1 items-center md:flex-none md:w-full md:max-w-[560px]"
      role="search"
      onSubmit={submitSearch}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
      }}
    >
      <label htmlFor="portal-search" className="sr-only">
        Search incidents, alerts, and security feed
      </label>
      <div className="flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 shadow-[var(--shadow-soft)]">
        <Search className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
        <input
          id="portal-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searchOpen && searchTerm.trim().length >= 2}
          aria-controls="portal-search-results"
          aria-activedescendant={
            searchOpen && searchResults.length > 0
              ? `portal-search-result-${activeSearchResult}`
              : undefined
          }
          value={searchTerm}
          onFocus={() => setSearchOpen(true)}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setActiveSearchResult(0);
            setSearchOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && searchResults.length > 0) {
              event.preventDefault();
              setSearchOpen(true);
              setActiveSearchResult((current) => (current + 1) % searchResults.length);
            } else if (event.key === "ArrowUp" && searchResults.length > 0) {
              event.preventDefault();
              setSearchOpen(true);
              setActiveSearchResult((current) => (current - 1 + searchResults.length) % searchResults.length);
            } else if (event.key === "Escape") {
              setSearchOpen(false);
            }
          }}
          placeholder="Search incidents, alerts, and feed..."
          className="w-full border-0 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
        />
      </div>
      {searchOpen && searchTerm.trim().length >= 2 && (
        <div
          id="portal-search-results"
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[min(60vh,420px)] overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-1.5 shadow-lg"
        >
          {searchResults.length > 0 ? (
            searchResults.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                id={`portal-search-result-${index}`}
                type="button"
                role="option"
                aria-selected={activeSearchResult === index}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveSearchResult(index)}
                onClick={() => openSearchResult(result)}
                className={`flex w-full min-w-0 flex-col items-start rounded-lg px-3 py-2 text-left transition-colors ${
                  activeSearchResult === index
                    ? "bg-[var(--primary-soft)]"
                    : "hover:bg-[var(--muted)]"
                }`}
              >
                <span className="w-full truncate text-[13px] font-medium text-[var(--foreground)]">
                  {result.title}
                </span>
                <span className="mt-0.5 w-full truncate text-[11px] text-[var(--muted-foreground)]">
                  {result.type} · {result.detail}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-[12px] text-[var(--muted-foreground)]">
              No matching incidents, alerts, or security feed items.
            </p>
          )}
        </div>
      )}
    </form>
  );
}

export function IncidentPortalShell({
  children,
  activeNav = "incidents",
  breadcrumbs,
  eyebrow,
  pageTitle,
  description,
  actions,
  titleClassName,
}: {
  children: React.ReactNode;
  activeNav?: PortalNavKey;
  breadcrumbs?: React.ReactNode;
  eyebrow?: React.ReactNode;
  pageTitle: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  titleClassName?: string;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentUser = useCurrentUser();

  return (
    <main className="h-dvh w-full overflow-hidden bg-[var(--page-bg)] text-[var(--foreground)]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[230px] flex-col border-r border-[#E2EAE5] bg-white transition-transform md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#EAF6EE] text-[#087443] ring-1 ring-[#D8EADD]">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-[12px] font-semibold tracking-[0.02em] text-[#087443]">ICE 2.0</div>
            <div className="text-[10px] text-[#64746C]">NSIA · In Case of Emergency</div>
          </div>
        </div>

        <div className="px-3 pt-3">
          <div className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-[#64746C]">Current workspace</div>
          <div className="rounded-lg border border-[#E2EAE5] bg-[#F1F5F3] px-2.5 py-1.5">
            <span className="block truncate text-[11px] font-medium leading-4 text-[#64746C]">{currentUser.role}</span>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {navItems.map(({ key, label, href, icon: Icon }) => {
            const active = key === activeNav;
            return (
              <Link
                key={label}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "mb-2 flex h-11 items-center gap-2.5 rounded-xl px-3 text-[14px] font-medium transition-colors last:mb-0",
                  active ? "bg-[#E7F1EA] text-[#1A2B22]" : "text-[#1F2D27] hover:bg-[#F3F7F5] hover:text-[#087443]",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#087443]" : "text-[#1F2D27]")} strokeWidth={2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <footer className="mt-auto shrink-0 px-4 pb-5 pt-6">
          <Link
            href="/support"
            aria-label="Contact ICT Support"
            className="flex min-h-[58px] items-center gap-3 rounded-xl bg-[#F0F4F2] px-3.5 py-3 transition-colors hover:bg-[#E7EEEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087443]"
          >
            <Headset aria-hidden="true" className="h-5 w-5 shrink-0 text-[#087443]" strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold leading-[17px] text-[#18251E]">Need help?</span>
              <span className="block text-[11px] leading-[16px] text-[#64746C]">Contact ICT Support</span>
            </span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#64746C]" strokeWidth={1.8} />
          </Link>

          <SessionRoleSwitcher />

          <button type="button" disabled title="Sign out is not available yet." className="mt-3 flex min-h-8 w-full cursor-not-allowed items-center gap-3 rounded-md px-3 py-1.5 text-left text-[12px] font-medium text-[#718178] opacity-70">
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

      <div className="flex h-dvh min-w-0 flex-col overflow-hidden md:ml-[230px]">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel)] px-3 py-3 sm:gap-3 sm:px-4 lg:px-6">
          <button
            type="button"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] md:hidden"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Suspense fallback={<PortalSearchFallback />}>
            <PortalSearchField />
          </Suspense>

        </header>

        <div className="flex-1 overflow-y-auto bg-[var(--background)]">
          <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6 lg:py-6">
            {breadcrumbs && <div className="mb-4 flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">{breadcrumbs}</div>}

            <div className="mb-5 flex flex-col gap-4 min-[1700px]:flex-row min-[1700px]:items-end min-[1700px]:justify-between">
              <div>
                {eyebrow && <div className="text-[13px] text-[var(--muted-foreground)]">{eyebrow}</div>}
                <h1 className={cn("font-semibold tracking-[-0.04em] text-[var(--foreground)]", titleClassName ?? "text-[38px] leading-[44px]")}>{pageTitle}</h1>
                {description && <p className="mt-1 text-[15px] text-[var(--muted-foreground)]">{description}</p>}
              </div>

              {actions && (
                <div className="flex flex-wrap items-center gap-2 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
                  {actions}
                </div>
              )}
            </div>

            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
