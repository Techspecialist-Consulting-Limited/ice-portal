"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  FileText,
  Hash,
  Info,
  ListChecks,
  MapPin,
  Megaphone,
  ShieldCheck,
  Tag,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { IceSelect, type IceSelectOption } from "@/components/ice-select";
import type { AlertItem, AlertNotificationType, IncidentItem } from "@/app/dashboard/mock-data";
import {
  getIncidentStateServerSnapshot,
  getIncidentStateSnapshot,
  subscribeToIncidentState,
  updateIncident,
} from "../../incident-state";
import { PriorityBadge, StatusBadge } from "../../incident-status";
import { IncidentPortalShell } from "../../incident-shell";
import {
  getAlertStateServerSnapshot,
  getAlertStateSnapshot,
  subscribeToAlertState,
} from "@/app/alerts/alert-state";
import { AlertStatusBadge } from "@/app/alerts/alert-status";
import { currentActorLabel } from "@/app/auth/current-user";
import {
  ALERT_PRIORITY_OPTIONS,
  ALERT_SHAREABILITY_OPTIONS,
  MAX_ALERT_SUMMARY,
  MAX_ALERT_TITLE,
  alertDraftFieldsFromItem,
  commitAlert,
  emptyAlertDraftFields,
  validateAlertDraft,
  writeAlertDraft,
  type AlertDraftErrors,
  type AlertDraftFields,
} from "@/app/alerts/alert-draft";

// No RBAC model exists in this prototype — the Risk Administrator is the only
// actor on this workspace. This function is the single point where a real role
// check would live; it currently permits conversion for every actor.
function canConvertIncident() {
  return true;
}

const FIELD_IDS: Partial<Record<keyof AlertDraftFields, string>> = {
  title: "convert-title",
  summary: "convert-summary",
  category: "convert-category",
  priority: "convert-priority",
  audience: "convert-audience",
  location: "convert-location",
  acknowledgementTargetCount: "convert-acknowledgementTargetCount",
};

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

function incidentSignature(incident: IncidentItem) {
  return [
    incident.id,
    incident.title,
    incident.description ?? "",
    incident.category,
    incident.priority,
    incident.status,
    incident.location,
    incident.department ?? "",
  ].join("|");
}

function seedFieldsFromIncident(incident: IncidentItem, categories: string[]): AlertDraftFields {
  return {
    ...emptyAlertDraftFields(),
    title: incident.title,
    summary: incident.description ?? "",
    category: categories.includes(incident.category) ? incident.category : "",
    priority: incident.priority,
    location: incident.location,
    shareability: "Internal only",
    // The source is the originating unit. The incident's department (or, failing
    // that, its category) names where the communication came from — this is a real
    // value, not an invented one.
    source: incident.department ?? incident.category,
  };
}

function defaultType(incident: IncidentItem): AlertNotificationType {
  return incident.priority === "Critical" ? "Alert" : "Advisory";
}

function SelectControl({
  id,
  label,
  value,
  options,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  options: IceSelectOption[];
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <IceSelect
      id={id}
      label={label}
      hideLabel
      value={value}
      options={options}
      onChange={onChange}
      invalid={invalid}
    />
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#991b1b]">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {message}
    </p>
  );
}

function TypeCard({
  value,
  title,
  description,
  icon: Icon,
  selected,
  onSelect,
}: {
  value: AlertNotificationType;
  title: string;
  description: string;
  icon: typeof Megaphone;
  selected: boolean;
  onSelect: (value: AlertNotificationType) => void;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer gap-3 rounded-[14px] border p-4 transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--primary)] has-[:focus-visible]:ring-offset-2",
        selected ? "border-[var(--primary)] bg-[#eaf7ee]" : "border-[var(--border)] bg-white hover:bg-[var(--muted)]",
      )}
    >
      <input
        type="radio"
        name="convert-type"
        value={value}
        checked={selected}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-[var(--primary)] text-white" : "bg-[var(--primary-soft)] text-[var(--primary)]",
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[var(--foreground)]">{title}</span>
          <span
            aria-hidden="true"
            className={cn(
              "ml-auto flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
              selected ? "border-[var(--primary)]" : "border-[var(--border)]",
            )}
          >
            {selected && <span className="h-[10px] w-[10px] rounded-full bg-[var(--primary)]" />}
          </span>
        </span>
        <span className="mt-1 block text-[12px] leading-5 text-[var(--muted-foreground)]">{description}</span>
      </span>
    </label>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: React.ReactNode }) {
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

function ChecklistItem({ label, done, hint }: { label: string; done: boolean; hint?: string }) {
  return (
    <li className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-[16px] w-[16px] shrink-0 text-[var(--primary)]" strokeWidth={2} />
      ) : (
        <span
          aria-hidden="true"
          className="mt-[3px] h-[13px] w-[13px] shrink-0 rounded-full border-[1.5px] border-[var(--border)]"
        />
      )}
      <span className="min-w-0">
        <span className={cn("block text-[13px]", done ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[12px] text-[var(--muted-foreground)]">{hint}</span>}
      </span>
    </li>
  );
}

function StateCard({
  icon: Icon,
  tone = "neutral",
  title,
  children,
  actions,
}: {
  icon: typeof Info;
  tone?: "neutral" | "warning" | "danger";
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const toneClass =
    tone === "warning"
      ? "bg-[#fff4d6] text-[#9a6700]"
      : tone === "danger"
        ? "bg-[#fee2e2] text-[#991b1b]"
        : "bg-[var(--primary-soft)] text-[var(--primary)]";
  return (
    <div className="rounded-[18px] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-soft)]">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneClass)}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <h2 className="mt-3 text-[16px] font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="mt-1.5 max-w-xl text-[13px] leading-6 text-[var(--muted-foreground)]">{children}</div>
      {actions && <div className="mt-4 flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function ConvertToAlertContent({ incidentId }: { incidentId: string }) {
  const router = useRouter();

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

  const incident = incidents.find((item) => item.id === incidentId) ?? null;

  const categoryOptions = useMemo(() => {
    const values = new Set(alerts.map((entry) => entry.category).filter(Boolean));
    return Array.from(values).sort();
  }, [alerts]);

  const [fields, setFields] = useState<AlertDraftFields>(emptyAlertDraftFields);
  const [notificationType, setNotificationType] = useState<AlertNotificationType>("Advisory");
  const [errors, setErrors] = useState<AlertDraftErrors>({});
  const [saveError, setSaveError] = useState("");
  const [navError, setNavError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [seededKey, setSeededKey] = useState("");

  const [now] = useState<number | null>(() => (typeof window === "undefined" ? null : Date.now()));
  const today = now !== null ? new Date(now).toISOString().slice(0, 10) : "";

  const submittingRef = useRef(false);
  const redirectTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
    };
  }, []);

  // Re-seed the form when the incident resolves (server seed -> client store). No
  // effect-setState: matches the alert editor pattern.
  const seedKey = incident ? incidentSignature(incident) : `loading:${incidentId}`;
  if (seededKey !== seedKey) {
    setSeededKey(seedKey);
    if (incident) {
      setFields(seedFieldsFromIncident(incident, categoryOptions));
      setNotificationType(defaultType(incident));
    }
    setErrors({});
    setSaveError("");
    setNavError("");
  }

  const notFound = !incident && seededKey === `loading:${incidentId}`;
  const permitted = canConvertIncident();
  const eligible = incident?.status === "Verified";
  const existingConverted = alerts.find((entry) => entry.sourceIncidentId === incidentId) ?? null;
  const categoriesUnavailable = categoryOptions.length === 0;

  const update = <K extends keyof AlertDraftFields>(field: K, value: AlertDraftFields[K]) => {
    setFields((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  function focusFirstError(nextErrors: AlertDraftErrors) {
    const firstKey = (Object.keys(nextErrors) as Array<keyof AlertDraftFields>).find((key) => FIELD_IDS[key]);
    if (firstKey) document.getElementById(FIELD_IDS[firstKey] as string)?.focus();
  }

  function navigate(href: string) {
    try {
      router.push(href);
    } catch {
      setNavError(
        "We couldn't open that screen automatically. Use the link below to continue — nothing has been lost.",
      );
    }
  }

  function openPreview(alert: AlertItem) {
    // Seed the in-memory draft so the existing review screen renders the record,
    // then hand off to the standard preview route.
    writeAlertDraft({
      key: `edit:${alert.id}`,
      mode: "edit",
      alertId: alert.id,
      fields: alertDraftFieldsFromItem(alert),
    });
    navigate(`/alerts/${encodeURIComponent(alert.id)}/edit/preview`);
  }

  function handleCreate() {
    if (submittingRef.current || !incident || !eligible || existingConverted) return;

    const nextErrors = validateAlertDraft(fields, "draft", today);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSaveError("");
      focusFirstError(nextErrors);
      return;
    }

    setSaveError("");
    setNavError("");
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const saved = commitAlert(fields, {
        mode: "create",
        target: "draft",
        sourceIncidentId: incident.id,
        notificationType,
      });
      if (!saved) throw new Error("Alert could not be created");

      // Record the conversion on the incident. The incident status is deliberately
      // left unchanged — converting is not the same as broadcasting.
      updateIncident(incident.id, (current) => ({
        ...current,
        timeline: [
          ...(current.timeline ?? []),
          {
            title: notificationType === "Alert" ? "Alert draft created" : "Advisory draft created",
            detail: `${saved.id} was prepared from this incident by ${currentActorLabel()}. The draft is not published or broadcast.`,
            time: formatTimestamp(new Date()),
          },
        ],
      }));

      // Seed the draft so the standard preview can render it immediately.
      writeAlertDraft({
        key: `edit:${saved.id}`,
        mode: "edit",
        alertId: saved.id,
        fields,
      });

      setCreatedId(saved.id);
      redirectTimer.current = window.setTimeout(
        () => router.push(`/alerts/${encodeURIComponent(saved.id)}/edit/preview`),
        1200,
      );
    } catch {
      submittingRef.current = false;
      setSubmitting(false);
      setSaveError("We couldn't create the draft. Nothing was changed — please try again.");
    }
  }

  const breadcrumbs = (current: React.ReactNode) => (
    <>
      <Link href="/" className="hover:text-[var(--primary)]">
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <Link href="/incidents" className="hover:text-[var(--primary)]">
        Incidents
      </Link>
      <span aria-hidden="true">/</span>
      {current}
    </>
  );

  const backAction = (
    <Link
      href="/incidents"
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)]"
    >
      <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
      Return to queue
    </Link>
  );

  // --- Not found -------------------------------------------------------------
  if (notFound) {
    return (
      <IncidentPortalShell
        breadcrumbs={breadcrumbs(<span className="font-medium text-[var(--foreground)]">Not found</span>)}
        pageTitle="Incident not found"
        description="The requested incident could not be located."
        actions={backAction}
      >
        <StateCard icon={TriangleAlert} tone="warning" title="Incident not available">
          <p>
            No incident matches the reference{" "}
            <span className="font-medium text-[var(--foreground)]">{incidentId || "provided"}</span>. It may have
            been removed or the reference may be incorrect.
          </p>
        </StateCard>
      </IncidentPortalShell>
    );
  }

  // From here on `incident` is resolved.
  if (!incident) return null;

  const incidentBreadcrumb = (
    <Link href={`/incidents/${incident.id}`} className="hover:text-[var(--primary)]">
      {incident.id}
    </Link>
  );

  // --- No permission ---------------------------------------------------------
  if (!permitted) {
    return (
      <IncidentPortalShell
        activeNav="incidents"
        breadcrumbs={breadcrumbs(
          <>
            {incidentBreadcrumb}
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--foreground)]">Convert to alert</span>
          </>,
        )}
        pageTitle="Convert incident to alert"
        description="Prepare an approved security communication from verified incident information."
        actions={backAction}
      >
        <StateCard icon={ShieldCheck} tone="danger" title="You do not have permission to do this">
          <p>
            Converting an incident into an alert or advisory requires the Risk Administrator role. Ask an
            administrator if you believe you should have access.
          </p>
        </StateCard>
      </IncidentPortalShell>
    );
  }

  // --- Not eligible ----------------------------------------------------------
  if (!eligible) {
    return (
      <IncidentPortalShell
        activeNav="incidents"
        breadcrumbs={breadcrumbs(
          <>
            {incidentBreadcrumb}
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--foreground)]">Convert to alert</span>
          </>,
        )}
        pageTitle="Convert incident to alert"
        description="Prepare an approved security communication from verified incident information."
        actions={
          <Link
            href={`/incidents/${incident.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            Back to incident
          </Link>
        }
      >
        <StateCard
          icon={TriangleAlert}
          tone="warning"
          title="This incident can’t be converted yet"
        >
          <p className="flex flex-wrap items-center gap-x-1.5">
            Only a verified incident can be turned into an alert or advisory.{" "}
            <span className="font-medium text-[var(--foreground)]">{incident.id}</span> is currently
            <StatusBadge status={incident.status} className="mx-1 align-middle" />.
          </p>
          <p className="mt-2">
            Verify the incident first, then return to this screen. Converting never publishes or broadcasts the
            communication — it only prepares a draft.
          </p>
        </StateCard>
      </IncidentPortalShell>
    );
  }

  // --- Draft created ---------------------------------------------------------
  if (createdId) {
    return (
      <IncidentPortalShell
        activeNav="incidents"
        breadcrumbs={breadcrumbs(
          <>
            {incidentBreadcrumb}
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--foreground)]">Convert to alert</span>
          </>,
        )}
        pageTitle="Convert incident to alert"
        description="Prepare an approved security communication from verified incident information."
      >
        <StateCard icon={CheckCircle2} title={`Draft ${createdId} created`}>
          <p>
            {createdId} was created as a {notificationType.toLowerCase()} draft from{" "}
            <span className="font-medium text-[var(--foreground)]">{incident.id}</span>. It has not been published
            or broadcast — review and publish it through the standard alert workflow.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/alerts/${encodeURIComponent(createdId)}/edit/preview`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)]"
            >
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
              Review &amp; publish
            </Link>
            <Link
              href={`/alerts/${encodeURIComponent(createdId)}/edit`}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
            >
              <FileText className="h-4 w-4" strokeWidth={2} />
              Open draft
            </Link>
            <Link
              href={`/incidents/${incident.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Back to incident
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-[var(--muted-foreground)]">
            Taking you to the review screen…
          </p>
        </StateCard>
      </IncidentPortalShell>
    );
  }

  // --- Duplicate draft -------------------------------------------------------
  if (existingConverted) {
    return (
      <IncidentPortalShell
        activeNav="incidents"
        breadcrumbs={breadcrumbs(
          <>
            {incidentBreadcrumb}
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--foreground)]">Convert to alert</span>
          </>,
        )}
        pageTitle="Convert incident to alert"
        description="Prepare an approved security communication from verified incident information."
        actions={
          <Link
            href={`/incidents/${incident.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            Back to incident
          </Link>
        }
      >
        <StateCard
          icon={Info}
          title="A draft already exists for this incident"
        >
          <p>
            Only one draft can be created from an incident.{" "}
            <span className="font-medium text-[var(--foreground)]">{existingConverted.id}</span> —{" "}
            {existingConverted.title} — was prepared from{" "}
            <span className="font-medium text-[var(--foreground)]">{incident.id}</span>. Continue with that draft
            instead of creating another.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AlertStatusBadge status={existingConverted.status} />
            {!existingConverted.publishedAt && (
              <span className="text-[12px] text-[var(--muted-foreground)]">Not published yet</span>
            )}
          </div>
          {navError && (
            <p role="alert" className="mt-3 flex items-start gap-2 text-[12px] text-[#991b1b]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              {navError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/alerts/${encodeURIComponent(existingConverted.id)}/edit`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)]"
            >
              <FileText className="h-4 w-4" strokeWidth={2} />
              Open draft
            </Link>
            <button
              type="button"
              onClick={() => openPreview(existingConverted)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            >
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
              Preview
            </button>
          </div>
        </StateCard>
      </IncidentPortalShell>
    );
  }

  // --- Categories unavailable ------------------------------------------------
  if (categoriesUnavailable) {
    return (
      <IncidentPortalShell
        activeNav="incidents"
        breadcrumbs={breadcrumbs(
          <>
            {incidentBreadcrumb}
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--foreground)]">Convert to alert</span>
          </>,
        )}
        pageTitle="Convert incident to alert"
        description="Prepare an approved security communication from verified incident information."
        actions={
          <Link
            href={`/incidents/${incident.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)]"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            Back to incident
          </Link>
        }
      >
        <StateCard icon={TriangleAlert} tone="warning" title="Categories are unavailable">
          <p>
            Alert categories could not be loaded, so a draft can’t be prepared right now. Try again later — no
            draft has been created.
          </p>
        </StateCard>
      </IncidentPortalShell>
    );
  }

  // --- Form ------------------------------------------------------------------
  const checklist = [
    { label: "Source incident is verified", done: eligible },
    { label: "Message title added", done: fields.title.trim().length >= 4 },
    { label: "Category selected", done: Boolean(fields.category) },
    { label: "Priority selected", done: Boolean(fields.priority) },
    { label: "Message added", done: Boolean(fields.summary.trim()) },
    { label: "Audience defined", done: Boolean(fields.audience.trim()) },
    { label: "Location recorded", done: Boolean(fields.location.trim()) },
  ];
  const ready = checklist.every((item) => item.done);
  const typeLabel = notificationType.toLowerCase();

  return (
    <IncidentPortalShell
      activeNav="incidents"
      breadcrumbs={breadcrumbs(
        <>
          {incidentBreadcrumb}
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[var(--foreground)]">Convert to alert</span>
        </>,
      )}
      pageTitle="Convert incident to alert"
      description="Prepare an approved security communication from verified incident information."
      actions={
        <Link
          href={`/incidents/${incident.id}`}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-3.5 text-sm font-medium text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--muted)]"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
          Back to incident
        </Link>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        {/* Left column — the communication being prepared */}
        <div className="space-y-4">
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <Megaphone className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Communication type
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              Choose how this communication should be framed. This sets the draft type and does not change the
              incident.
            </p>

            <div role="radiogroup" aria-label="Communication type" className="mt-4 grid gap-3 sm:grid-cols-2">
              <TypeCard
                value="Alert"
                title="Alert"
                description="Notify staff of something that needs immediate attention."
                icon={Megaphone}
                selected={notificationType === "Alert"}
                onSelect={setNotificationType}
              />
              <TypeCard
                value="Advisory"
                title="Advisory"
                description="Give staff guidance or situational information."
                icon={Info}
                selected={notificationType === "Advisory"}
                onSelect={setNotificationType}
              />
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <FileText className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              {notificationType === "Alert" ? "Alert content" : "Advisory content"}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              Seeded from the source incident. Edit as needed so the message is accurate and clear.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="convert-title" className="block text-[13px] font-semibold text-[var(--foreground)]">
                  Title <span className="text-[#991b1b]">*</span>
                </label>
                <input
                  id="convert-title"
                  type="text"
                  value={fields.title}
                  onChange={(event) => update("title", event.target.value.slice(0, MAX_ALERT_TITLE))}
                  maxLength={MAX_ALERT_TITLE}
                  aria-invalid={errors.title ? true : undefined}
                  aria-describedby={errors.title ? "convert-title-error" : undefined}
                  placeholder="Short, specific title staff will recognise"
                  className={cn(
                    "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                    errors.title ? "border-[#d9a0a0]" : "border-[var(--border)]",
                  )}
                />
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <FieldError id="convert-title-error" message={errors.title} />
                  <p aria-live="polite" className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                    {fields.title.length} / {MAX_ALERT_TITLE}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="convert-category" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Category <span className="text-[#991b1b]">*</span>
                  </label>
                  <div className="mt-2">
                    <SelectControl
                      id="convert-category"
                      label="Category"
                      invalid={Boolean(errors.category)}
                      value={fields.category}
                      onChange={(value) => update("category", value)}
                      options={[
                        { value: "", label: "Choose a category", disabled: true },
                        ...categoryOptions.map((value) => ({ value, label: value })),
                      ]}
                    />
                  </div>
                  <FieldError id="convert-category-error" message={errors.category} />
                </div>

                <div>
                  <label htmlFor="convert-priority" className="block text-[13px] font-semibold text-[var(--foreground)]">
                    Priority <span className="text-[#991b1b]">*</span>
                  </label>
                  <div className="mt-2">
                    <SelectControl
                      id="convert-priority"
                      label="Priority"
                      invalid={Boolean(errors.priority)}
                      value={fields.priority}
                      onChange={(value) => update("priority", value as AlertDraftFields["priority"])}
                      options={[
                        { value: "", label: "Choose a priority", disabled: true },
                        ...ALERT_PRIORITY_OPTIONS.map((value) => ({ value, label: value })),
                      ]}
                    />
                  </div>
                  <FieldError id="convert-priority-error" message={errors.priority} />
                </div>
              </div>

              <div>
                <label htmlFor="convert-summary" className="block text-[13px] font-semibold text-[var(--foreground)]">
                  Message <span className="text-[#991b1b]">*</span>
                </label>
                <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                  What is happening, what it means, and what staff should do. Plain text only.
                </p>
                <textarea
                  id="convert-summary"
                  value={fields.summary}
                  onChange={(event) => update("summary", event.target.value.slice(0, MAX_ALERT_SUMMARY))}
                  rows={7}
                  maxLength={MAX_ALERT_SUMMARY}
                  aria-invalid={errors.summary ? true : undefined}
                  aria-describedby={errors.summary ? "convert-summary-error" : undefined}
                  placeholder="Write the message staff will read."
                  className={cn(
                    "mt-2 min-h-[170px] w-full resize-y rounded-xl border bg-[var(--muted)] px-3.5 py-3 text-sm leading-6 text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                    errors.summary ? "border-[#d9a0a0]" : "border-[var(--border)]",
                  )}
                />
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <FieldError id="convert-summary-error" message={errors.summary} />
                  <p aria-live="polite" className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--muted-foreground)]">
                    {fields.summary.length} / {MAX_ALERT_SUMMARY}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <UsersRound className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Target audience
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="convert-audience" className="block text-[13px] font-semibold text-[var(--foreground)]">
                  Audience <span className="text-[#991b1b]">*</span>
                </label>
                <input
                  id="convert-audience"
                  type="text"
                  value={fields.audience}
                  onChange={(event) => update("audience", event.target.value)}
                  aria-invalid={errors.audience ? true : undefined}
                  aria-describedby={errors.audience ? "convert-audience-error" : undefined}
                  placeholder="e.g. Abuja HQ staff, All staff"
                  className={cn(
                    "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                    errors.audience ? "border-[#d9a0a0]" : "border-[var(--border)]",
                  )}
                />
                <FieldError id="convert-audience-error" message={errors.audience} />
              </div>

              <div>
                <label htmlFor="convert-location" className="block text-[13px] font-semibold text-[var(--foreground)]">
                  Location <span className="text-[#991b1b]">*</span>
                </label>
                <input
                  id="convert-location"
                  type="text"
                  value={fields.location}
                  onChange={(event) => update("location", event.target.value)}
                  aria-invalid={errors.location ? true : undefined}
                  aria-describedby={errors.location ? "convert-location-error" : undefined}
                  placeholder="e.g. Abuja HQ, Lagos office"
                  className={cn(
                    "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                    errors.location ? "border-[#d9a0a0]" : "border-[var(--border)]",
                  )}
                />
                <FieldError id="convert-location-error" message={errors.location} />
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <ClipboardList className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Acknowledgement
            </h2>
            <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
              Require recipients to confirm they have seen this communication. The acknowledgement target is
              recorded with the alert, and no notice is sent to recipients.
            </p>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">Require acknowledgement</p>
                  <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    {fields.acknowledgementRequired ? "Recipients must confirm." : "Not required."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fields.acknowledgementRequired}
                  aria-label="Require acknowledgement"
                  onClick={() => update("acknowledgementRequired", !fields.acknowledgementRequired)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                    fields.acknowledgementRequired
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-white text-[var(--muted-foreground)] hover:bg-[var(--muted)]",
                  )}
                >
                  {fields.acknowledgementRequired ? "Required" : "Not required"}
                </button>
              </div>

              {fields.acknowledgementRequired && (
                <div>
                  <label
                    htmlFor="convert-acknowledgementTargetCount"
                    className="block text-[13px] font-semibold text-[var(--foreground)]"
                  >
                    Target recipients <span className="text-[#991b1b]">*</span>
                  </label>
                  <p className="mt-0.5 text-[12px] text-[var(--muted-foreground)]">
                    How many people must acknowledge. The acknowledged count starts at 0.
                  </p>
                  <input
                    id="convert-acknowledgementTargetCount"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={fields.acknowledgementTargetCount}
                    onChange={(event) => update("acknowledgementTargetCount", event.target.value)}
                    aria-invalid={errors.acknowledgementTargetCount ? true : undefined}
                    aria-describedby={
                      errors.acknowledgementTargetCount ? "convert-acknowledgementTargetCount-error" : undefined
                    }
                    placeholder="e.g. 250"
                    className={cn(
                      "mt-2 h-11 w-full rounded-xl border bg-[var(--muted)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1",
                      errors.acknowledgementTargetCount ? "border-[#d9a0a0]" : "border-[var(--border)]",
                    )}
                  />
                  <FieldError
                    id="convert-acknowledgementTargetCount-error"
                    message={errors.acknowledgementTargetCount}
                  />
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <ShieldCheck className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Sharing permissions
            </h2>

            <div className="mt-4">
              <label htmlFor="convert-shareability" className="block text-[13px] font-semibold text-[var(--foreground)]">
                Shareability
              </label>
              <div className="mt-2">
                <SelectControl
                  id="convert-shareability"
                  label="Shareability"
                  value={fields.shareability}
                  onChange={(value) => update("shareability", value as AlertDraftFields["shareability"])}
                  options={ALERT_SHAREABILITY_OPTIONS.map((value) => ({ value, label: value }))}
                />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-foreground)]">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                Recorded as a label only &mdash; sharing is not enforced.
              </p>
            </div>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <ExternalLink className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Source
            </h2>
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">
              This draft is linked to the verified incident it was prepared from. The link is recorded and cannot
              be edited here.
            </p>
            <Link
              href={`/incidents/${incident.id}`}
              className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3.5 py-3 transition-colors hover:bg-[var(--primary-softest)]"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--foreground)]">{incident.id}</span>
                <span className="block truncate text-[12px] text-[var(--muted-foreground)]">{incident.title}</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" strokeWidth={2} />
            </Link>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-2 rounded-xl border border-[#f0d8b8] bg-[#fff4d6] px-3 py-2.5 text-[12px] leading-5 text-[#9a6700]">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              <span>
                Creating a draft does not publish or broadcast it, and does not notify anyone. The draft is saved
                with draft status and must be published separately through the standard alert workflow.
              </span>
            </div>

            {saveError && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-3 py-2 text-sm text-[#991b1b]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                {saveError}
              </p>
            )}

            {navError && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-3 py-2 text-sm text-[#991b1b]">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                {navError}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => navigate(`/incidents/${incident.id}`)}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Megaphone className="h-[18px] w-[18px]" strokeWidth={2} />
                {submitting ? "Creating draft…" : `Create ${typeLabel} draft`}
              </button>
            </div>
          </section>
        </div>

        {/* Right column — source incident and draft readiness */}
        <aside className="space-y-4">
          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
                <ClipboardList className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
                Source incident
              </h2>
              <StatusBadge status={incident.status} />
            </div>

            <div className="mt-4">
              <h3 className="text-[14px] font-semibold leading-5 text-[var(--foreground)]">{incident.title}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--muted-foreground)]">
                <span className="font-medium text-[var(--foreground)]">{incident.id}</span>
                <span aria-hidden="true">·</span>
                <span>Reported {incident.reported}</span>
              </p>
            </div>

            <dl className="mt-3 divide-y divide-[var(--border)]">
              <SummaryRow icon={Hash} label="Reference" value={incident.id} />
              <SummaryRow icon={Tag} label="Category" value={incident.category} />
              <SummaryRow icon={MapPin} label="Location" value={incident.location} />
              <SummaryRow
                icon={CircleAlert}
                label="Priority"
                value={<PriorityBadge priority={incident.priority} />}
              />
              <SummaryRow icon={Building2} label="Department" value={incident.department ?? "Not available"} />
              <SummaryRow icon={CalendarClock} label="Reported" value={incident.reported} />
            </dl>

            <Link
              href={`/incidents/${incident.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--primary)] hover:text-[var(--primary-strong)]"
            >
              View incident details
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </section>

          <section className="rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--foreground)]">
              <ListChecks className="h-[18px] w-[18px] text-[var(--primary)]" strokeWidth={2} />
              Draft readiness
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[var(--muted-foreground)]">
              {ready
                ? "Everything needed for a draft is in place."
                : "Complete the highlighted details before creating the draft."}
            </p>

            <ul className="mt-4 space-y-2.5">
              {checklist.map((item) => (
                <ChecklistItem key={item.label} label={item.label} done={item.done} />
              ))}
            </ul>

            <div
              className={cn(
                "mt-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium",
                ready
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[#f0d8b8] bg-[#fff4d6] text-[#9a6700]",
              )}
            >
              {ready ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
              ) : (
                <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2} />
              )}
              {ready ? "Ready to create draft" : "Not ready to create draft"}
            </div>

            <p className="mt-3 flex items-start gap-2 text-[12px] leading-5 text-[var(--muted-foreground)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span>
                Readiness only covers creating the draft. Publishing happens later, through the standard alert
                workflow.
              </span>
            </p>
          </section>
        </aside>
      </div>
    </IncidentPortalShell>
  );
}
