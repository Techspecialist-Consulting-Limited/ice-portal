"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Flame,
  Hash,
  History,
  MapPin,
  Search,
  UserRound,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import {
  demoResponders,
  demoResponseTeams,
  type IncidentItem,
} from "@/app/dashboard/mock-data";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
  updateIncident,
} from "../../incident-state";
import { PriorityBadge, StatusBadge, ToneBadge } from "../../incident-status";
import { IncidentPortalShell } from "../../incident-shell";
import { currentActorLabel } from "@/app/auth/current-user";

type TargetType = "responder" | "team";

const MAX_NOTE_LENGTH = 500;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatTimestamp(date: Date) {
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function escalationBlockReason(status: IncidentItem["status"]): string | null {
  if (status === "Escalated") return "This incident is already escalated.";
  if (status === "Broadcast") return "Escalation is not available once an incident has been broadcast.";
  if (status === "Rejected") return "Escalation is not available for a rejected report.";
  if (status === "Resolved" || status === "Closed") return "Escalation is not available for a resolved or closed incident.";
  return null;
}

function assignmentSignature(incident: IncidentItem) {
  const a = incident.assignment;
  return [a?.assigneeId ?? "", a?.team ?? "", a?.note ?? "", a?.escalated ? "1" : "0", a?.escalatedAt ?? "", a?.escalationReason ?? ""].join("|");
}

function deriveSelection(incident: IncidentItem | null) {
  const a = incident?.assignment;
  const responderId = a?.assigneeId ?? "";
  const teamId = a?.team ? demoResponseTeams.find((team) => team.name === a.team)?.id ?? "" : "";
  const type: TargetType = responderId ? "responder" : teamId ? "team" : "responder";
  return { responderId, teamId, type };
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="flex items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
        <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.9} />
        {label}
      </dt>
      <dd className="text-right text-[13px] font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

export function AssignPageContent({
  incidentId,
  escalateMode,
}: {
  incidentId: string;
  escalateMode: boolean;
}) {
  const router = useRouter();

  const incidents = useSyncExternalStore(
    subscribeToIncidentState,
    getIncidentStateSnapshot,
    getIncidentStateServerSnapshot,
  );
  const incident = incidents.find((item) => item.id === incidentId) ?? null;

  const [targetType, setTargetType] = useState<TargetType>(deriveSelection(incident).type);
  const [selectedResponderId, setSelectedResponderId] = useState(deriveSelection(incident).responderId);
  const [selectedTeamId, setSelectedTeamId] = useState(deriveSelection(incident).teamId);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState(incident?.assignment?.note ?? "");
  const [escalateReason, setEscalateReason] = useState(incident?.assignment?.escalationReason ?? "");
  const [targetError, setTargetError] = useState("");
  const [escalateError, setEscalateError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState<"assignment" | "escalation" | null>(null);
  const [toast, setToast] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [seededSignature, setSeededSignature] = useState(incident ? assignmentSignature(incident) : "");

  const submittingRef = useRef(false);
  const redirectRef = useRef<number | null>(null);
  const targetGroupRef = useRef<HTMLDivElement>(null);
  const escalateRef = useRef<HTMLTextAreaElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Re-sync the editable fields when the incident's stored assignment resolves
  // (server seed -> client localStorage) or changes underneath us.
  const currentSignature = incident ? assignmentSignature(incident) : "";
  if (seededSignature !== currentSignature) {
    const selection = deriveSelection(incident);
    setSeededSignature(currentSignature);
    setTargetType(selection.type);
    setSelectedResponderId(selection.responderId);
    setSelectedTeamId(selection.teamId);
    setNote(incident?.assignment?.note ?? "");
    setEscalateReason(incident?.assignment?.escalationReason ?? "");
  }

  useEffect(() => {
    return () => {
      if (redirectRef.current !== null) window.clearTimeout(redirectRef.current);
    };
  }, []);

  useEffect(() => {
    if (!confirmOpen) return;

    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [confirmOpen]);

  const selectedResponder = demoResponders.find((person) => person.id === selectedResponderId) ?? null;
  const selectedTeam = demoResponseTeams.find((team) => team.id === selectedTeamId) ?? null;
  const hasTarget = targetType === "responder" ? Boolean(selectedResponder) : Boolean(selectedTeam);

  const filteredResponders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return demoResponders;
    return demoResponders.filter((person) =>
      [person.name, person.role, person.team, person.department]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(q)),
    );
  }, [query]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return demoResponseTeams;
    return demoResponseTeams.filter((team) =>
      [team.name, team.function, team.department]
        .filter(Boolean)
        .some((value) => (value as string).toLowerCase().includes(q)),
    );
  }, [query]);

  if (!incident) {
    return (
      <IncidentPortalShell
        breadcrumbs={
          <>
            <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/incidents" className="hover:text-[var(--primary)]">Incidents</Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--foreground)]">Not found</span>
          </>
        }
        pageTitle="Incident not found"
        description="The requested incident could not be located."
        actions={
          <Link
            href="/incidents"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Return to queue
          </Link>
        }
      >
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            This assignment cannot be opened because no incident matches the reference{" "}
            <span className="font-medium text-[var(--foreground)]">{incidentId || "provided"}</span>. It may have
            been removed or the reference may be incorrect.
          </p>
          <Link
            href="/incidents"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-strong)]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Return to the incident queue
          </Link>
        </div>
      </IncidentPortalShell>
    );
  }

  const assignment = incident.assignment;
  const escalateBlock = escalationBlockReason(incident.status);
  const assignmentHistory = (incident.timeline ?? []).filter((event) => /assign|escalat/i.test(event.title));

  const scheduleRedirect = () => {
    redirectRef.current = window.setTimeout(() => router.push(`/incidents/${incident.id}`), 1100);
  };

  const handleTargetType = (value: TargetType) => {
    setTargetType(value);
    setQuery("");
    setTargetError("");
  };

  const handleSaveAssignment = () => {
    if (submittingRef.current) return;

    if (["Rejected", "Resolved", "Closed"].includes(incident.status)) {
      setSaveError(`Assignment is not available for a ${incident.status.toLowerCase()} incident.`);
      return;
    }

    if (!hasTarget) {
      setTargetError(
        targetType === "responder"
          ? "Select a responder before saving the assignment."
          : "Select a response team before saving the assignment.",
      );
      targetGroupRef.current?.querySelector<HTMLInputElement>("input[type=radio]")?.focus();
      return;
    }

    setTargetError("");
    setSaveError("");
    submittingRef.current = true;
    setSubmitting("assignment");

    try {
      const stamp = formatTimestamp(new Date());
      const assigneeName = targetType === "responder" ? selectedResponder?.name : undefined;
      const assigneeId = targetType === "responder" ? selectedResponder?.id : undefined;
      const assigneeRole = targetType === "responder" ? selectedResponder?.role : undefined;
      const teamName = targetType === "team" ? selectedTeam?.name : selectedResponder?.team;
      const targetLabel = targetType === "responder" ? selectedResponder?.name ?? "" : selectedTeam?.name ?? "";

      const updated = updateIncident(incident.id, (current) => ({
        ...current,
        assignment: {
          ...current.assignment,
          assignee: assigneeName,
          assigneeId,
          assigneeRole,
          team: teamName,
          note: note.trim() || undefined,
          assignedAt: stamp,
        },
        timeline: [
          ...(current.timeline ?? []),
          {
            title: "Responder assigned",
            detail: `${targetLabel} assigned to handle the incident${teamName ? ` (${teamName})` : ""}.${
              note.trim() ? ` Handover note: ${note.trim()}` : ""
            }`,
            time: stamp,
          },
        ],
      }));

      if (!updated) throw new Error("Incident could not be updated");

      setToast(`${targetLabel} is now responsible for this incident.`);
      scheduleRedirect();
    } catch {
      submittingRef.current = false;
      setSubmitting(null);
      setSaveError("We couldn't save the assignment. The incident was left unchanged — please try again.");
    }
  };

  const handleOpenEscalation = () => {
    if (submittingRef.current) return;

    const blockReason = escalationBlockReason(incident.status);
    if (blockReason) {
      setSaveError(blockReason);
      return;
    }

    if (!escalateReason.trim()) {
      setEscalateError("Add an escalation rationale before escalating the incident.");
      escalateRef.current?.focus();
      return;
    }

    setEscalateError("");
    setConfirmOpen(true);
  };

  const handleConfirmEscalation = () => {
    setConfirmOpen(false);
    if (submittingRef.current) return;

    const reason = escalateReason.trim();
    if (!reason) return;

    setEscalateError("");
    setSaveError("");
    submittingRef.current = true;
    setSubmitting("escalation");

    try {
      const stamp = formatTimestamp(new Date());
      const updated = updateIncident(incident.id, (current) => {
        const blockReason = escalationBlockReason(current.status);
        if (blockReason) throw new Error(blockReason);
        return {
          ...current,
          status: "Escalated",
          assignment: {
            ...current.assignment,
            escalated: true,
            escalationReason: reason,
            escalatedAt: stamp,
          },
          timeline: [
            ...(current.timeline ?? []),
            {
              title: "Incident escalated",
              detail: `Escalated by ${currentActorLabel()}. ${reason}`,
              time: stamp,
            },
          ],
        };
      });

      if (!updated) throw new Error("Incident could not be updated");

      setToast("Incident escalated. The escalation has been recorded on the incident.");
      scheduleRedirect();
    } catch {
      submittingRef.current = false;
      setSubmitting(null);
      setSaveError("We couldn't record the escalation. The incident was left unchanged — please try again.");
    }
  };

  const breadcrumbs = (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">Home</Link>
      <span aria-hidden="true">/</span>
      <Link href="/incidents" className="hover:text-[var(--primary)]">Incidents</Link>
      <span aria-hidden="true">/</span>
      <Link href={`/incidents/${incident.id}`} className="hover:text-[var(--primary)]">{incident.id}</Link>
      <span aria-hidden="true">/</span>
      <span className="font-medium text-[var(--foreground)]">Assign &amp; Escalate</span>
    </>
  );

  return (
    <IncidentPortalShell
      breadcrumbs={breadcrumbs}
      pageTitle="Assign &amp; Escalate"
      description={
        <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">{incident.id}</span>
          <span aria-hidden="true">·</span>
          <PriorityBadge priority={incident.priority} />
          <StatusBadge status={incident.status} />
        </span>
      }
      actions={
        <Link
          href={`/incidents/${incident.id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:bg-[var(--muted)]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to incident
        </Link>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          {/* Main panel A + B — assignment and handover note */}
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <UserRoundCheck className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Assign responder
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              Select the person or team responsible for the next response step.
            </p>

            <div className="mt-4" role="radiogroup" aria-label="Assignment target type">
              <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--muted)] p-1">
                {(
                  [
                    { value: "responder" as const, label: "Responder", icon: UserRound },
                    { value: "team" as const, label: "Team", icon: UsersRound },
                  ]
                ).map(({ value, label, icon: Icon }) => {
                  const active = targetType === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        "relative flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--primary)] has-[:focus-visible]:ring-offset-1",
                        active ? "bg-white text-[var(--foreground)] shadow-[var(--shadow-soft)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                      )}
                    >
                      <input
                        type="radio"
                        name="assign-target-type"
                        value={value}
                        checked={active}
                        onChange={() => handleTargetType(value)}
                        className="sr-only"
                      />
                      <Icon className={cn("h-[16px] w-[16px]", active ? "text-[var(--primary)]" : "")} strokeWidth={2} />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="assign-search" className="mb-2 block text-[13px] font-semibold text-[var(--foreground)]">
                {targetType === "responder" ? "Assigned responder" : "Response team"}
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" strokeWidth={2} />
                <input
                  id="assign-search"
                  type="search"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={targetType === "responder" ? "Search responders by name, role, or team" : "Search teams by name or function"}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--muted)] py-2.5 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
                />
              </div>

              <div
                ref={targetGroupRef}
                role="radiogroup"
                aria-label={targetType === "responder" ? "Responder options" : "Response team options"}
                className="mt-2 max-h-[272px] space-y-1.5 overflow-y-auto pr-0.5"
              >
                {targetType === "responder" ? (
                  demoResponders.length === 0 ? (
                    <p className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-4 text-[13px] text-[var(--muted-foreground)]">
                      The responder directory could not be loaded. Try again later.
                    </p>
                  ) : filteredResponders.length === 0 ? (
                    <p className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-4 text-[13px] text-[var(--muted-foreground)]">
                      No responders match “{query.trim()}”.
                    </p>
                  ) : (
                    filteredResponders.map((person) => {
                      const active = selectedResponderId === person.id;
                      return (
                        <label
                          key={person.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--primary)] has-[:focus-visible]:ring-offset-1",
                            active ? "border-[var(--primary)] bg-[#eaf7ee]" : "border-[var(--border)] bg-white hover:bg-[var(--muted)]",
                          )}
                        >
                          <input
                            type="radio"
                            name="assign-target"
                            value={person.id}
                            checked={active}
                            onChange={() => {
                              setSelectedResponderId(person.id);
                              setTargetError("");
                            }}
                            className="sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                              active ? "bg-[var(--primary)] text-white" : "bg-[#DDF2E7] text-[#087443]",
                            )}
                          >
                            {initials(person.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-[var(--foreground)]">{person.name}</span>
                            <span className="block truncate text-[12px] text-[var(--muted-foreground)]">
                              {person.role} · {person.team}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )
                ) : demoResponseTeams.length === 0 ? (
                  <p className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-4 text-[13px] text-[var(--muted-foreground)]">
                    The response team directory could not be loaded. Try again later.
                  </p>
                ) : filteredTeams.length === 0 ? (
                  <p className="rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-4 text-[13px] text-[var(--muted-foreground)]">
                    No teams match “{query.trim()}”.
                  </p>
                ) : (
                  filteredTeams.map((team) => {
                    const active = selectedTeamId === team.id;
                    return (
                      <label
                        key={team.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--primary)] has-[:focus-visible]:ring-offset-1",
                          active ? "border-[var(--primary)] bg-[#eaf7ee]" : "border-[var(--border)] bg-white hover:bg-[var(--muted)]",
                        )}
                      >
                        <input
                          type="radio"
                          name="assign-target"
                          value={team.id}
                          checked={active}
                          onChange={() => {
                            setSelectedTeamId(team.id);
                            setTargetError("");
                          }}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            active ? "bg-[var(--primary)] text-white" : "bg-[#eaf3ff] text-[#1d4ed8]",
                          )}
                        >
                          <UsersRound className="h-[18px] w-[18px]" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-[var(--foreground)]">{team.name}</span>
                          <span className="block truncate text-[12px] text-[var(--muted-foreground)]">
                            {team.function}
                            {team.department ? ` · ${team.department}` : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              {targetError && (
                <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] text-[#991b1b]">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  {targetError}
                </p>
              )}
            </div>

            {assignment?.assignee || assignment?.team ? (
              <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">
                Current assignment:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {assignment?.assignee ?? assignment?.team}
                </span>
                {assignment?.team && assignment?.assignee ? ` · ${assignment.team}` : ""}
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-[var(--muted-foreground)]">Not assigned</p>
            )}

            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <label htmlFor="handover-note" className="block text-[13px] font-semibold text-[var(--foreground)]">
                Handover note
              </label>
              <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">Add concise context for the assigned responder.</p>
              <textarea
                id="handover-note"
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, MAX_NOTE_LENGTH))}
                rows={4}
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Add relevant context, actions already taken, or information the responder should know."
                className="mt-2 min-h-[110px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1"
              />
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="text-[11px] text-[var(--muted-foreground)]">Optional. Maximum {MAX_NOTE_LENGTH} characters.</p>
                <p aria-live="polite" className="shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                  {note.length} / {MAX_NOTE_LENGTH}
                </p>
              </div>
            </div>

            {hasTarget && (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Assignment summary</p>
                <p className="mt-1 text-[13px] text-[var(--foreground)]">
                  {targetType === "responder" && selectedResponder ? (
                    <>
                      <span className="font-semibold">{selectedResponder.name}</span> · {selectedResponder.role} · {selectedResponder.team}
                    </>
                  ) : selectedTeam ? (
                    <>
                      <span className="font-semibold">{selectedTeam.name}</span> · {selectedTeam.function}
                      {selectedTeam.department ? ` · ${selectedTeam.department}` : ""}
                    </>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                  {note.trim() ? "Handover note included." : "No handover note added."}
                </p>
              </div>
            )}

            {saveError && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-3 py-2 text-sm text-[#991b1b]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                {saveError}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => router.push(`/incidents/${incident.id}`)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignment}
                disabled={submitting !== null}
                className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2} />
                {submitting === "assignment" ? "Saving…" : "Save assignment"}
              </button>
            </div>
          </section>

          {/* Main panel C — escalation */}
          <section
            className={cn(
              "rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]",
              escalateMode && "ring-1 ring-[var(--primary)]",
            )}
          >
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <ArrowUpRight className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Escalation
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              Raise this incident through the approved escalation path when it is permitted.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[var(--muted-foreground)]">Current status</span>
              {assignment?.escalated ? (
                <>
                  <ToneBadge label="Escalated" tone="danger" />
                  {assignment.escalatedAt && (
                    <span className="text-[12px] text-[var(--muted-foreground)]">{assignment.escalatedAt}</span>
                  )}
                </>
              ) : (
                <ToneBadge label="No escalation recorded" tone="neutral" />
              )}
            </div>

            {assignment?.escalated && assignment.escalationReason && (
              <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)]">
                {assignment.escalationReason}
              </p>
            )}

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 text-[12px] text-[var(--muted-foreground)]">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span>
                Escalation destination is not configured for this workspace. Escalating records the decision on the
                incident and does not contact responders automatically.
              </span>
            </div>

            {escalateBlock ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#f0d8b8] bg-[#fff4d6] px-3 py-2.5 text-[13px] text-[#9a6700]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{escalateBlock}</span>
              </div>
            ) : (
              <>
                <div className="mt-4">
                  <label htmlFor="escalate-reason" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Escalation rationale
                  </label>
                  <textarea
                    id="escalate-reason"
                    ref={escalateRef}
                    value={escalateReason}
                    onChange={(event) => {
                      setEscalateReason(event.target.value);
                      if (event.target.value.trim()) setEscalateError("");
                    }}
                    rows={3}
                    aria-invalid={escalateError ? true : undefined}
                    aria-describedby={escalateError ? "escalate-error" : undefined}
                    placeholder="Explain why this incident needs escalation and any urgency context."
                    className={cn(
                      "mt-2 w-full resize-y rounded-xl border bg-[var(--muted)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      escalateError ? "border-[#d9a0a0]" : "border-[var(--border)]",
                    )}
                  />
                  {escalateError && (
                    <p id="escalate-error" role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] text-[#991b1b]">
                      <CircleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                      {escalateError}
                    </p>
                  )}
                </div>

                <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    onClick={handleOpenEscalation}
                    disabled={submitting !== null}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#e0a8a8] bg-white px-4 py-2.5 text-sm font-medium text-[#991b1b] transition-colors hover:bg-[#fff1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#991b1b] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2} />
                    {submitting === "escalation" ? "Escalating…" : "Escalate incident"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {/* Side panel D — incident summary */}
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <ClipboardList className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Incident summary
            </h2>

            <div className="mt-4">
              <h3 className="text-[14px] font-semibold leading-5 text-[var(--foreground)]">{incident.title}</h3>
              <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
                <span className="font-medium text-[var(--foreground)]">{incident.id}</span> · Reported {incident.reported}
              </p>
            </div>

            <dl className="mt-3 divide-y divide-[var(--border)]">
              <SummaryRow icon={Hash} label="Reference" value={incident.id} />
              <SummaryRow icon={Flame} label="Category" value={incident.category} />
              <SummaryRow icon={MapPin} label="Location" value={incident.location} />
              <SummaryRow icon={CircleAlert} label="Priority" value={<PriorityBadge priority={incident.priority} />} />
              <SummaryRow icon={History} label="Status" value={<StatusBadge status={incident.status} />} />
              <SummaryRow icon={CalendarClock} label="Reported" value={incident.reported} />
            </dl>

            <Link
              href={`/incidents/${incident.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              View incident details
            </Link>
          </section>

          {/* Side panel E — current assignment and history */}
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <History className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Current assignment
            </h2>

            {assignment?.assignee || assignment?.team ? (
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DDF2E7] text-[12px] font-semibold text-[#087443]">
                    {initials(assignment.assignee ?? assignment.team ?? "")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[var(--foreground)]">
                      {assignment.assignee ?? "Response team"}
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted-foreground)]">
                      {assignment.assigneeRole ? `${assignment.assigneeRole} · ` : ""}
                      {assignment.team ?? "No team"}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 space-y-1.5 text-[12px] text-[var(--muted-foreground)]">
                  {assignment.assignedAt && (
                    <div className="flex items-center justify-between gap-3">
                      <dt>Assigned</dt>
                      <dd className="font-medium text-[var(--foreground)]">{assignment.assignedAt}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <dt>Escalation</dt>
                    <dd className="font-medium text-[var(--foreground)]">{assignment.escalated ? "Escalated" : "Not escalated"}</dd>
                  </div>
                </dl>

                {assignment.note && (
                  <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 text-[12px] leading-5 text-[var(--foreground)]">
                    {assignment.note}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-[13px] text-[var(--muted-foreground)]">No responder assigned yet.</p>
            )}

            {assignmentHistory.length > 0 && (
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">History</p>
                <ol className="mt-2 space-y-2.5">
                  {assignmentHistory.map((event, index) => (
                    <li key={`${event.title}-${index}`} className="flex gap-2.5">
                      <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--foreground)]">{event.title}</p>
                        <p className="text-[12px] text-[var(--muted-foreground)]">{event.time}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        </aside>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--foreground)] shadow-[0_10px_30px_rgba(17,24,39,0.12)]"
        >
          <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-[var(--primary)]" strokeWidth={2} />
          {toast}
        </div>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="escalate-dialog-title"
            className="w-full max-w-md rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff4d6] text-[#9a6700]">
                <CircleAlert className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h2 id="escalate-dialog-title" className="text-[15px] font-semibold text-[var(--foreground)]">
                    Escalate incident
                  </h2>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    aria-label="Close dialog"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
                <p className="mt-1 text-[13px] leading-5 text-[var(--muted-foreground)]">
                  This will mark <span className="font-medium text-[var(--foreground)]">{incident.id}</span> as escalated and
                  record the escalation on the incident. Continue?
                </p>
                {escalateReason.trim() && (
                  <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-[12px] text-[var(--foreground)]">
                    {escalateReason.trim()}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
              >
                Keep editing
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={handleConfirmEscalation}
                className="inline-flex items-center gap-2 rounded-xl bg-[#c62828] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[#a81f1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c62828] focus-visible:ring-offset-2"
              >
                <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2} />
                Confirm escalation
              </button>
            </div>
          </div>
        </div>
      )}
    </IncidentPortalShell>
  );
}
