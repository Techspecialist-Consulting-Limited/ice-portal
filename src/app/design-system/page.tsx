import {
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  Filter,
  Info,
  LayoutGrid,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

const swatches = [
  { name: "Primary Green", hex: "#087443", className: "bg-[#087443]" },
  { name: "Green 600", hex: "#10935A", className: "bg-[#10935A]" },
  { name: "Green 100", hex: "#E8F6ED", className: "bg-[#E8F6ED] text-slate-900" },
  { name: "Green 50", hex: "#F4FAF7", className: "bg-[#F4FAF7] text-slate-900" },
  { name: "Gray 900", hex: "#111827", className: "bg-[#111827]" },
  { name: "Gray 600", hex: "#4B5563", className: "bg-[#4B5563]" },
  { name: "Gray 200", hex: "#E5E7EB", className: "bg-[#E5E7EB] text-slate-900" },
  { name: "Gray 50", hex: "#F9FAFB", className: "bg-[#F9FAFB] text-slate-900" },
  { name: "Success", hex: "#16A34A", className: "bg-[#16A34A]" },
  { name: "Warning", hex: "#F59E0B", className: "bg-[#F59E0B]" },
  { name: "Danger", hex: "#DC2626", className: "bg-[#DC2626]" },
  { name: "Info", hex: "#3B82F6", className: "bg-[#3B82F6]" },
];

const navItems = [
  { label: "Dashboard", active: false, Icon: LayoutGrid },
  { label: "Incidents", active: true, Icon: ShieldCheck },
  { label: "Alerts", active: false, Icon: Bell },
  { label: "Security Feed", active: false, Icon: Search },
  { label: "Reports", active: false, Icon: Download },
  { label: "Users", active: false, Icon: Users },
  { label: "Settings", active: false, Icon: Settings },
];

const statuses = [
  { label: "Critical", tone: "danger" },
  { label: "Advisory", tone: "warning" },
  { label: "Informational", tone: "info" },
  { label: "Submitted", tone: "neutral" },
  { label: "Under Review", tone: "primary" },
  { label: "Verified", tone: "success" },
  { label: "Escalated", tone: "warning" },
  { label: "Delivered", tone: "success" },
  { label: "Pending", tone: "neutral" },
  { label: "Failed", tone: "danger" },
];

const typeScale = [
  { label: "Page title / H1", value: "32 / 40", sample: "ICE 2.0 Portal" },
  { label: "Section title / H2", value: "24 / 32", sample: "Risk dashboard" },
  { label: "Card title / H3", value: "18 / 26", sample: "Active incidents" },
  { label: "Body", value: "14 / 20", sample: "Operational status for active cases." },
  { label: "Label", value: "12 / 16", sample: "Priority" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md";
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const variants = {
    primary: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-strong)]",
    secondary:
      "border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--primary-soft)] hover:border-[var(--primary)]",
    ghost: "bg-transparent text-[var(--foreground)] hover:bg-[var(--primary-soft)]",
    destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:opacity-90",
  };

  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
      )}
      disabled={disabled}
      type="button"
    >
      {icon}
      {children}
    </button>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const tones: Record<string, string> = {
    success: "border border-transparent bg-[#eaf7ee] text-[#166534]",
    warning: "border border-transparent bg-[#fff4d6] text-[#9a6700]",
    danger: "border border-transparent bg-[#fee2e2] text-[#991b1b]",
    info: "border border-transparent bg-[#eaf3ff] text-[#1d4ed8]",
    neutral: "border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]",
    primary: "border border-transparent bg-[var(--primary-soft)] text-[var(--primary)]",
  };

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", tones[tone] ?? tones.neutral)}>
      {label}
    </span>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{eyebrow}</p>
      <h2 className="text-[24px] font-semibold leading-8 text-[var(--foreground)]">{title}</h2>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--foreground)]">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-6 xl:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--panel)] px-5 py-4 shadow-[var(--shadow-soft)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">ICE 2.0</div>
              <h1 className="text-lg font-semibold">Design system</h1>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <button type="button" className="rounded-md px-2.5 py-1.5 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]">Overview</button>
            <button type="button" className="rounded-md px-2.5 py-1.5 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]">Tokens</button>
            <button type="button" className="rounded-md px-2.5 py-1.5 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]">Components</button>
            <button type="button" className="rounded-md px-2.5 py-1.5 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]">Preview</button>
          </nav>
        </header>

        <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-soft)]">
          <div className="flex min-h-[860px] flex-col xl:flex-row">
            <aside className="w-full border-b border-[var(--border)] bg-[var(--primary-softest)] xl:w-[240px] xl:border-b-0 xl:border-r">
              <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--panel)] text-[var(--primary)] ring-1 ring-[var(--border)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">NSIA</div>
                  <div className="text-sm font-semibold">Risk Administrator</div>
                </div>
              </div>

              <div className="space-y-1 px-3 py-4">
                {navItems.map(({ label, active, Icon }) => (
                  <button
                    key={label}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "bg-[var(--primary)] text-white shadow-sm"
                        : "text-[var(--foreground)] hover:bg-white hover:text-[var(--primary)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-2 border-t border-[var(--border)] px-3 py-4">
                <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-[var(--border)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]">AR</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">Alicia Reed</div>
                    <div className="truncate text-[11px] text-[var(--muted-foreground)]">Operations lead</div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1 bg-[var(--background)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-3 md:px-6">
                <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                  <span>Home</span>
                  <ChevronRight className="h-4 w-4" />
                  <span>Design systems</span>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Search" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)]">
                    <Search className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Notifications" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground)]">
                    <Bell className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-8 p-5 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Foundation</p>
                    <h2 className="mt-1 text-[32px] font-semibold leading-[40px]">ICE 2.0 portal foundations</h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary">Review tokens</Button>
                    <Button>Submit for approval</Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Open incidents", "24", "+2 this week"],
                    ["Criticals", "06", "2 escalated"],
                    ["Alerts", "18", "3 require action"],
                    ["Security feed", "42", "verified"],
                  ].map(([title, value, meta]) => (
                    <div key={title} className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{title}</div>
                      <div className="mt-3 flex items-end justify-between">
                        <div className="text-[30px] font-semibold leading-none text-[var(--foreground)]">{value}</div>
                        <div className="rounded-full bg-[var(--primary-soft)] px-2 py-1 text-[10px] font-medium text-[var(--primary)]">{meta}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                  <div className="space-y-6 rounded-[20px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                    <SectionHeader eyebrow="Colour" title="Brand and status palette" />
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {swatches.map((swatch) => (
                        <div key={swatch.name} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-2">
                          <div className={cn("h-16 rounded-lg border border-black/5", swatch.className)} />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium text-[var(--foreground)]">{swatch.name}</div>
                              <div className="text-[11px] text-[var(--muted-foreground)]">{swatch.hex}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                    <SectionHeader eyebrow="Status" title="Badge variants" />
                    <div className="mt-4 flex flex-wrap gap-2">
                      {statuses.map((status) => (
                        <StatusBadge key={status.label} label={status.label} tone={status.tone} />
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.15fr_1.2fr]">
                  <div className="rounded-[20px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                    <SectionHeader eyebrow="Type" title="Typography scale" />
                    <div className="mt-5 space-y-4">
                      {typeScale.map((scale) => (
                        <div key={scale.label} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                          <div className="mb-2 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                            <span>{scale.label}</span>
                            <span>{scale.value}</span>
                          </div>
                          <div className={cn(
                            scale.label.includes("Page") && "text-[32px] font-semibold leading-[40px]",
                            scale.label.includes("Section") && "text-[24px] font-semibold leading-8",
                            scale.label.includes("Card") && "text-[18px] font-semibold leading-[26px]",
                            scale.label.includes("Body") && "text-[14px] leading-5",
                            scale.label.includes("Label") && "text-[12px] font-medium leading-4",
                          )}>
                            {scale.sample}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                    <SectionHeader eyebrow="Controls" title="Buttons and inputs" />
                    <div className="mt-5 space-y-5">
                      <div className="flex flex-wrap gap-2">
                        <Button>Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Destructive</Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[12px] font-medium text-[var(--muted-foreground)]">Text input</label>
                          <input className="h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-[var(--primary)]" defaultValue="Search incidents" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[12px] font-medium text-[var(--muted-foreground)]">Select</label>
                          <div className="flex h-10 items-center justify-between rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--muted-foreground)]">
                            <span>All categories</span>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                          <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]" />
                          Acknowledge alert
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                          <input type="radio" name="priority" defaultChecked className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]" />
                          High priority
                        </label>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[20px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                  <SectionHeader eyebrow="Data" title="Table and alert patterns" />
                  <div className="mt-5 space-y-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" icon={<Filter className="h-4 w-4" />}>Filter</Button>
                      <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />}>Export</Button>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                      <table className="min-w-full text-left">
                        <thead className="bg-[var(--muted)] text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                          <tr>
                            <th className="px-4 py-3 font-medium">Incident</th>
                            <th className="px-4 py-3 font-medium">Priority</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Owner</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white text-sm text-[var(--foreground)]">
                          {[
                            ["Flood alert review", "Critical", "Escalated", "A. Reed"],
                            ["Power outage report", "Advisory", "Under Review", "M. Chen"],
                            ["Air Quality watch", "Informational", "Verified", "S. Lee"],
                          ].map(([incident, priority, status, owner]) => (
                            <tr key={incident} className="border-t border-[var(--border)] hover:bg-[var(--muted)]">
                              <td className="px-4 py-3 font-medium">{incident}</td>
                              <td className="px-4 py-3"><StatusBadge tone={priority === "Critical" ? "danger" : priority === "Advisory" ? "warning" : "info"} label={priority} /></td>
                              <td className="px-4 py-3"><StatusBadge tone={status === "Verified" ? "success" : status === "Escalated" ? "warning" : "primary"} label={status} /></td>
                              <td className="px-4 py-3 text-[var(--muted-foreground)]">{owner}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--primary-soft)] p-4 text-sm text-[var(--foreground)]">
                        <div className="mb-2 flex items-center gap-2 font-medium text-[var(--primary)]"><Info className="h-4 w-4" /> Informational</div>
                        <p className="text-[var(--muted-foreground)]">This message explains a non-urgent operational update for the team.</p>
                      </div>
                      <div className="rounded-xl border border-[#f3d59d] bg-[#fff7e8] p-4 text-sm text-[#7a5300]">
                        <div className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Advisory</div>
                        <p>Follow-up is needed, but no immediate operational disruption is present.</p>
                      </div>
                      <div className="rounded-xl border border-[#f5b4b4] bg-[#fff1f2] p-4 text-sm text-[#991b1b]">
                        <div className="mb-2 flex items-center gap-2 font-medium"><CircleAlert className="h-4 w-4" /> Critical</div>
                        <p>Escalation is required and the response should be prioritized immediately.</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-[20px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                    <SectionHeader eyebrow="Structure" title="Breadcrumb and tabs" />
                    <div className="mt-4 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <span>Portal</span>
                      <ChevronRight className="h-4 w-4" />
                      <span>Incidents</span>
                      <ChevronRight className="h-4 w-4" />
                      <span className="text-[var(--foreground)]">Active cases</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {[
                        "Overview",
                        "Queue",
                        "Monitoring",
                        "Escalations",
                      ].map((tab, index) => (
                        <button
                          key={tab}
                          type="button"
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            index === 1 ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                          )}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                    <SectionHeader eyebrow="Feedback" title="Empty and loading states" />
                    <div className="mt-4 space-y-4">
                      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] p-5 text-center text-sm text-[var(--muted-foreground)]">
                        No results match the selected filters.
                      </div>
                      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-4">
                        <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200" />
                        <div className="h-3 w-full animate-pulse rounded-full bg-slate-200" />
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-200" />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[20px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
                  <SectionHeader eyebrow="Preview" title="Shared portal shell" />
                  <div className="mt-5 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-3">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]"><ShieldCheck className="h-4 w-4" /></div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">ICE 2.0</div>
                          <div className="text-sm font-medium">Risk dashboard</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm">View filters</Button>
                        <Button size="sm">Create alert</Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--primary-softest)] p-3">
                        {navItems.slice(0, 5).map(({ label, active, Icon }) => (
                          <div key={label} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm", active ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)]")}>
                            <Icon className="h-4 w-4" />
                            {label}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Operations</p>
                            <h3 className="text-[24px] font-semibold">Summary</h3>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                            <span>Last 7 days</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            ["Active alerts", "6"],
                            ["Acknowledged", "32"],
                            ["Escalated", "3"],
                          ].map(([title, value]) => (
                            <div key={title} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">{title}</div>
                              <div className="mt-2 text-[24px] font-semibold">{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
