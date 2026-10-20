"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  FileVideo,
  Flame,
  Hash,
  Images,
  MapPin,
  Tag,
} from "lucide-react";
import type { IncidentEvidence, IncidentEvidenceKind } from "@/app/dashboard/mock-data";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
} from "../../incident-state";
import { IncidentPortalShell } from "../../incident-shell";
import { PriorityBadge, StatusBadge } from "../../incident-status";
import { ResponderPortalShell } from "../../../responder/responder-shell";
import { canResponderAccessIncident } from "../../../responder/responder-access";
import { INCIDENT_RESPONDER } from "../../../auth/current-user";
import { useCurrentUser } from "../../../auth/current-user-provider";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function kindOf(item: IncidentEvidence): IncidentEvidenceKind {
  if (item.kind) return item.kind;
  const type = item.type.toLowerCase();
  if (type.includes("video") || type.includes("mp4")) return "video";
  if (type.includes("image") || type.includes("jpg") || type.includes("jpeg") || type.includes("png") || type.includes("svg")) return "image";
  return "document";
}

function KindGlyph({ kind, className }: { kind: IncidentEvidenceKind; className?: string }) {
  if (kind === "image") return <FileImage className={className} />;
  if (kind === "video") return <FileVideo className={className} />;
  return <FileText className={className} />;
}

const kindLabel: Record<IncidentEvidenceKind, string> = {
  image: "Image",
  video: "Video",
  document: "Document",
};

// Only same-origin (local) asset paths are eligible for "Open in new tab" and
// "Download" so that a stored filename or remote URL can never become an
// arbitrary navigation or download target.
function isSafeLocalSrc(src?: string): src is string {
  return typeof src === "string" && src.startsWith("/") && !src.startsWith("//") && !/[\r\n]/.test(src);
}

const secondaryButton =
  "inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]";
const primaryButton =
  "inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-3.5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";
const disabledButton =
  "inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-2.5 text-sm font-medium text-[var(--muted-foreground)]";

function OpenInNewTabAction({ item }: { item: IncidentEvidence | null }) {
  if (!item || !isSafeLocalSrc(item.src)) {
    return (
      <button
        type="button"
        disabled
        title="No file is selected for preview, or the file has no viewable URL."
        className={disabledButton}
      >
        <ExternalLink className="h-4 w-4" />
        Open in new tab
      </button>
    );
  }

  return (
    <a href={item.src} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
      <ExternalLink className="h-4 w-4" />
      Open in new tab
    </a>
  );
}

function DownloadAction({ item, full = false }: { item: IncidentEvidence | null; full?: boolean }) {
  const width = full ? "w-full justify-center" : "";

  if (!item || !isSafeLocalSrc(item.src)) {
    return (
      <button
        type="button"
        disabled
        title="The file for this incident record is not available."
        className={cn(disabledButton, width)}
      >
        <Download className="h-4 w-4" />
        Download file
      </button>
    );
  }

  return (
    <a href={item.src} download={item.name} className={cn(primaryButton, width)}>
      <Download className="h-4 w-4" />
      Download file
    </a>
  );
}

function RailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Flame;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--muted-foreground)]">
        <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.9} />
        {label}
      </span>
      <span className="flex min-w-0 justify-end text-right text-[13px] font-medium text-[var(--foreground)]">{children}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 truncate text-[13px] font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

type EvidenceShellProps = {
  children: React.ReactNode;
  breadcrumbs: React.ReactNode;
  pageTitle: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

function EvidenceShell(props: EvidenceShellProps) {
  const pathname = usePathname();
  if (pathname.startsWith("/responder/incidents/")) {
    return <ResponderPortalShell activeNav="assigned" {...props} />;
  }
  return <IncidentPortalShell {...props} />;
}

function EvidencePageContent() {
  const currentUser = useCurrentUser();
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isResponderView = pathname.startsWith("/responder/incidents/");
  const incidentId = Array.isArray(params.id) ? params.id[0] : params.id;
  const incidents = useSyncExternalStore(subscribeToIncidentState, getIncidentStateSnapshot, getIncidentStateServerSnapshot);
  const incident = incidents.find((item) => item.id === String(incidentId ?? ""));
  const requestedReturnTo = searchParams.get("returnTo");
  const incidentHref = isResponderView
    ? requestedReturnTo?.startsWith("/responder/incidents/")
      ? requestedReturnTo
      : `/responder/incidents/${encodeURIComponent(String(incidentId ?? ""))}`
    : `/incidents/${encodeURIComponent(String(incidentId ?? ""))}`;
  const queueHref = isResponderView ? "/responder/incidents" : "/incidents";

  const evidence = (incident?.evidence ?? []).filter((item) => !isResponderView || !item.demo);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastIncidentId, setLastIncidentId] = useState(incidentId);

  // Reset the selected file when navigating between incidents (React's
  // "adjust state during render" pattern, avoiding a setState-in-effect).
  if (lastIncidentId !== incidentId) {
    setLastIncidentId(incidentId);
    setSelectedIndex(0);
  }

  const itemCount = evidence.length;
  const safeIndex = itemCount > 0 ? Math.min(selectedIndex, itemCount - 1) : 0;
  const selected = evidence[safeIndex] ?? null;
  const selectedKind = selected ? kindOf(selected) : "document";

  const showNav = itemCount > 1;
  const goTo = (index: number) => setSelectedIndex(Math.min(Math.max(index, 0), itemCount - 1));

  useEffect(() => {
    if (itemCount < 2) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(0, Math.min(current, itemCount - 1) - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(itemCount - 1, Math.min(current, itemCount - 1) + 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [itemCount]);

  if (!incident) {
    return (
      <EvidenceShell
        breadcrumbs={
          <>
            <Link href={isResponderView ? "/responder/dashboard" : "/"}>{isResponderView ? "Responder Dashboard" : "Home"}</Link>
            <span>/</span>
            <Link href={queueHref}>{isResponderView ? "Assigned Incidents" : "Incidents"}</Link>
            <span>/</span>
            <span className="font-medium text-[var(--foreground)]">Not found</span>
          </>
        }
        pageTitle="Incident not found"
        description="The requested incident could not be located."
        actions={
          <Link href={queueHref} className={secondaryButton}>
            <ArrowLeft className="h-4 w-4" />
            Return to queue
          </Link>
        }
      >
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            We could not find an incident with the reference <span className="font-medium text-[var(--foreground)]">{String(incidentId ?? "")}</span>. It may
            have been removed or the link may be incorrect.
          </p>
          <Link href={queueHref} className={cn(secondaryButton, "mt-4")}>
            <ArrowLeft className="h-4 w-4" />
            Return to the incident queue
          </Link>
        </div>
      </EvidenceShell>
    );
  }

  if (
    (isResponderView && !canResponderAccessIncident(incident, currentUser)) ||
    (!isResponderView && currentUser.role === INCIDENT_RESPONDER)
  ) {
    return (
      <EvidenceShell
        breadcrumbs={
          <>
            <Link href={isResponderView ? "/responder/dashboard" : "/"}>{isResponderView ? "Responder Dashboard" : "Home"}</Link>
            <span>/</span>
            <Link href={queueHref}>{isResponderView ? "Assigned Incidents" : "Incidents"}</Link>
            <span>/</span>
            <span className="font-medium text-[var(--foreground)]">Access denied</span>
          </>
        }
        pageTitle="Access denied"
        description="You do not have permission to view this incident's media."
        actions={
          <Link href={isResponderView ? incidentHref : "/incidents"} className={secondaryButton}>
            <ArrowLeft className="h-4 w-4" />
            {isResponderView ? "Back to incident" : "Return to queue"}
          </Link>
        }
      >
        <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            Responder access is limited to incidents directly assigned to the current responder.
          </p>
        </div>
      </EvidenceShell>
    );
  }

  const breadcrumbs = (
    <>
      <Link href={isResponderView ? "/responder/dashboard" : "/"}>{isResponderView ? "Responder Dashboard" : "Home"}</Link>
      <span>/</span>
      <Link href={queueHref}>{isResponderView ? "Assigned Incidents" : "Incidents"}</Link>
      <span>/</span>
      <Link href={incidentHref}>{incident.id}</Link>
      <span>/</span>
      <span className="font-medium text-[var(--foreground)]">Evidence</span>
    </>
  );

  if (itemCount === 0) {
    return (
      <EvidenceShell
        breadcrumbs={breadcrumbs}
        pageTitle="Evidence review"
        description={
          <span className="text-[13px] text-[var(--muted-foreground)]">
            {incident.title} · {incident.id}
          </span>
        }
        actions={
          <Link href={incidentHref} className={secondaryButton}>
            <ArrowLeft className="h-4 w-4" />
            Back to incident
          </Link>
        }
      >
        <div className="flex flex-col items-center justify-center rounded-[18px] border border-[var(--border)] bg-white px-6 py-16 text-center shadow-[var(--shadow-soft)]">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Images className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-[18px] font-semibold text-[var(--foreground)]">No evidence to review</h2>
          <p className="mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
            No photos, video or documents have been attached to this incident yet. Evidence appears here once a reporter or
            administrator uploads it.
          </p>
          <Link href={incidentHref} className={cn(secondaryButton, "mt-6")}>
            <ArrowLeft className="h-4 w-4" />
            Back to incident
          </Link>
        </div>
      </EvidenceShell>
    );
  }

  const previewSrc = selected && isSafeLocalSrc(selected.src) ? selected.src : null;

  return (
    <EvidenceShell
      breadcrumbs={breadcrumbs}
      pageTitle="Evidence review"
      description={
        <span className="text-[13px] text-[var(--muted-foreground)]">
          {incident.title} · {incident.id}
        </span>
      }
      actions={
        <>
          <Link href={incidentHref} className={secondaryButton}>
            <ArrowLeft className="h-4 w-4" />
            Back to incident
          </Link>
          <OpenInNewTabAction item={selected} />
        </>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Selected evidence</p>
              <h2 className="mt-1.5 truncate text-[16px] font-semibold text-[var(--foreground)]">{selected?.name}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)]">
              <KindGlyph kind={selectedKind} className="h-3.5 w-3.5" />
              {kindLabel[selectedKind]}
            </span>
          </div>

          <div className="relative">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--muted)]">
              {previewSrc && selectedKind === "image" ? (
                <Image
                  src={previewSrc}
                  alt={`Preview of ${selected?.name ?? "evidence"}`}
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 900px, 100vw"
                  className="object-contain"
                />
              ) : previewSrc && selectedKind === "video" ? (
                <video src={previewSrc} controls className="h-full w-full object-contain" />
              ) : (
                <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-[var(--muted-foreground)]">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--primary)] shadow-[var(--shadow-soft)]">
                    <KindGlyph kind={selectedKind} className="h-7 w-7" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">Preview unavailable</p>
                    <p className="mt-1 text-xs">
                      {selected?.type ?? "Unsupported file type"}
                      {selected && isSafeLocalSrc(selected.src) ? " — open in a new tab to view this file." : " — no preview is available for this file."}
                    </p>
                  </div>
                </div>
              )}

              <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[var(--foreground)]/80 px-2.5 py-1 text-[11px] font-medium text-white">
                {safeIndex + 1} / {itemCount}
              </span>
            </div>

            {showNav && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(safeIndex - 1)}
                  disabled={safeIndex === 0}
                  aria-label="Previous evidence file"
                  className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-white/95 text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(safeIndex + 1)}
                  disabled={safeIndex === itemCount - 1}
                  aria-label="Next evidence file"
                  className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-white/95 text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          <div className="mt-4" role="group" aria-label="Evidence thumbnails">
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {evidence.map((item, index) => {
                const itemKind = kindOf(item);
                const isSelected = index === safeIndex;

                return (
                  <button
                    key={`${item.name}-${index}`}
                    type="button"
                    onClick={() => goTo(index)}
                    aria-label={`View ${item.name}`}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "relative h-[54px] w-[86px] shrink-0 overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
                      isSelected ? "border-[var(--primary)]" : "border-[var(--border)] hover:border-[var(--muted-foreground)]",
                    )}
                  >
                    {itemKind === "image" && isSafeLocalSrc(item.src) ? (
                      <Image src={item.src} alt="" fill unoptimized sizes="86px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[var(--muted)] text-[var(--muted-foreground)]">
                        <KindGlyph kind={itemKind} className="h-5 w-5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--primary)] shadow-[var(--shadow-soft)]">
              <KindGlyph kind={selectedKind} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{selected?.name}</p>
              <p className="mt-0.5 truncate text-[12px] text-[var(--muted-foreground)]">
                {selected?.type} · {selected?.size} · Uploaded {selected?.uploaded} by {selected?.uploader}
              </p>
            </div>
            <div className="shrink-0">
              <DownloadAction item={selected} />
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-5">
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">Incident details</h2>
              <Link href={incidentHref} className="text-[12px] font-medium text-[var(--primary)] hover:underline">
                View incident
              </Link>
            </div>
            <div className="mt-2 divide-y divide-[var(--border)]">
              <RailRow icon={Hash} label="Reference">
                {incident.id}
              </RailRow>
              <RailRow icon={Tag} label="Category">
                {incident.category}
              </RailRow>
              <RailRow icon={MapPin} label="Location">
                {incident.location}
              </RailRow>
              <RailRow icon={Flame} label="Priority">
                <PriorityBadge priority={incident.priority} />
              </RailRow>
              <RailRow icon={CircleAlert} label="Status">
                <StatusBadge status={incident.status} />
              </RailRow>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)]">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">File information</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <InfoRow label="File name" value={selected?.name ?? "—"} />
              <InfoRow label="File type" value={selected?.type ?? "—"} />
              <InfoRow label="File size" value={selected?.size ?? "—"} />
              <InfoRow label="Uploaded" value={selected?.uploaded ?? "—"} />
              <InfoRow label="Uploaded by" value={selected?.uploader ?? "—"} />
              <InfoRow label="Kind" value={kindLabel[selectedKind]} />
            </div>

            <div className="mt-4">
              <DownloadAction item={selected} full />
            </div>

            {selected && !isSafeLocalSrc(selected.src) && (
              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-[var(--muted-foreground)]">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                This file is recorded on the incident, but its contents are not available here.
              </p>
            )}
          </section>
        </aside>
      </div>
    </EvidenceShell>
  );
}

export default function IncidentEvidencePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--muted-foreground)]">Loading evidence…</div>}>
      <EvidencePageContent />
    </Suspense>
  );
}
