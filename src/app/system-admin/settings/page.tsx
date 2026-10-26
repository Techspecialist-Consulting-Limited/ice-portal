"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { BellRing, Building2, Check, CircleCheck } from "lucide-react";
import { SystemAdminShell } from "../system-admin-shell";
import {
  getPortalSettingsServerSnapshot,
  getPortalSettingsSnapshot,
  savePortalSettings,
  subscribeToPortalSettings,
  type PortalSettings,
} from "./settings-store";

const fieldClass = "h-10 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-[12px] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 text-[11px] leading-4 text-[var(--muted-foreground)]">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function SystemAdminSettingsPage() {
  const { settings, error: loadError } = useSyncExternalStore(
    subscribeToPortalSettings,
    getPortalSettingsSnapshot,
    getPortalSettingsServerSnapshot,
  );
  const [draftOverride, setDraftOverride] = useState<PortalSettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activityWarning, setActivityWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const draft = draftOverride ?? settings;
  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  function updateSetting<Key extends keyof PortalSettings>(key: Key, value: PortalSettings[Key]) {
    setDraftOverride((current) => ({ ...(current ?? settings), [key]: value }));
    setSaved(false);
    setSaveError(null);
  }

  function updateNotification(key: keyof PortalSettings["notifications"], checked: boolean) {
    setDraftOverride((current) => ({
      ...(current ?? settings),
      notifications: { ...(current ?? settings).notifications, [key]: checked },
    }));
    setSaved(false);
    setSaveError(null);
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const warning = savePortalSettings({
        ...draft,
        organizationName: draft.organizationName.trim(),
        portalName: draft.portalName.trim(),
      });
      setSaved(true);
      setSaveError(null);
      setActivityWarning(warning);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Settings could not be saved.");
      setActivityWarning(null);
      setSaved(false);
    }
  }

  function resetChanges() {
    setDraftOverride(null);
    setSaved(false);
    setSaveError(null);
  }

    return (
    <SystemAdminShell>
      <div className="mb-5">
        <p className="text-[11px] font-medium text-[var(--muted-foreground)]">System Administrator · Configuration</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-tight text-[var(--foreground)] sm:text-[32px]">
          Organization settings
        </h1>
        <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[var(--muted-foreground)]">
          Manage organization details and preferences used throughout the portal.
        </p>
      </div>

      {loadError && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-4 text-red-700">
          {loadError}
        </p>
      )}
      {saved && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] text-emerald-800">
          <CircleCheck className="h-4 w-4" aria-hidden="true" />
          Settings saved in this browser.
        </p>
      )}
      {activityWarning && (
        <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-4 text-amber-900">
          {activityWarning}
        </p>
      )}

      <form onSubmit={saveSettings} className="space-y-4">
        <SettingsSection
          icon={Building2}
          title="Organization profile"
          description="Edit the organization and portal names saved in these settings."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--foreground)]">Organization name</span>
              <input
                required
                maxLength={120}
                value={draft.organizationName}
                onChange={(event) => updateSetting("organizationName", event.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium text-[var(--foreground)]">Portal name</span>
              <input
                required
                maxLength={60}
                value={draft.portalName}
                onChange={(event) => updateSetting("portalName", event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={BellRing}
          title="Notification preferences"
          description="Choose which event types to include in your saved notification preferences."
        >
          <div className="divide-y divide-[var(--border)]">
            <label className="flex cursor-pointer items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <span>
                <span className="block text-[11px] font-medium text-[var(--foreground)]">Critical incident updates</span>
                <span className="mt-1 block text-[10px] leading-4 text-[var(--muted-foreground)]">Include critical incident updates in these preferences.</span>
              </span>
              <input
                type="checkbox"
                checked={draft.notifications.criticalIncidentUpdates}
                onChange={(event) => updateNotification("criticalIncidentUpdates", event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 py-3 last:pb-0">
              <span>
                <span className="block text-[11px] font-medium text-[var(--foreground)]">Administrative updates</span>
                <span className="mt-1 block text-[10px] leading-4 text-[var(--muted-foreground)]">Include portal account and access changes in these preferences.</span>
              </span>
              <input
                type="checkbox"
                checked={draft.notifications.administrativeUpdates}
                onChange={(event) => updateNotification("administrativeUpdates", event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              />
            </label>
          </div>
        </SettingsSection>

        {saveError && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-4 text-red-700">
            {saveError}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={resetChanges}
              disabled={!isDirty}
              className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-[11px] font-medium text-[var(--foreground)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel changes
            </button>
            <button
              type="submit"
              disabled={!isDirty}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[11px] font-semibold text-white hover:bg-[var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Save settings
            </button>
          </div>
        </div>
      </form>
    </SystemAdminShell>
  );
}
