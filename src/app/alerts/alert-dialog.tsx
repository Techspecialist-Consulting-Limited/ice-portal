"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, CircleAlert, TriangleAlert, X } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    confirmRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isDanger = tone === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-confirm-title"
        className="w-full max-w-md rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isDanger ? "bg-[#fee2e2] text-[#991b1b]" : "bg-[#eaf3ff] text-[#1d4ed8]",
            )}
          >
            <CircleAlert className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 id="alert-confirm-title" className="text-[15px] font-semibold text-[var(--foreground)]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-1 text-[13px] leading-5 text-[var(--muted-foreground)]">{description}</div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isDanger
                ? "bg-[#c62828] hover:bg-[#a81f1f] focus-visible:ring-[#c62828]"
                : "bg-[var(--primary)] hover:bg-[var(--primary-strong)] focus-visible:ring-[var(--primary)]",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EscalationDialog({
  alertId,
  onConfirm,
  onClose,
}: {
  alertId: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const trimmed = reason.trim();
  const invalid = touched && trimmed.length === 0;

  const submit = () => {
    setTouched(true);
    if (trimmed.length === 0) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-escalate-title"
        className="w-full max-w-lg rounded-[18px] border border-[var(--border)] bg-white p-5 shadow-[0_20px_50px_rgba(17,24,39,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fef3c7] text-[#92400e]">
            <TriangleAlert className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 id="alert-escalate-title" className="text-[15px] font-semibold text-[var(--foreground)]">
                Escalate alert
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <p className="mt-1 text-[13px] leading-5 text-[var(--muted-foreground)]">
              Escalating <span className="font-medium text-[var(--foreground)]">{alertId}</span> records an escalation
              event in the alert history and marks the alert as escalated. The reason you give is stored with the event.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="escalate-reason" className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            Reason for escalation
          </label>
          <textarea
            id="escalate-reason"
            ref={textareaRef}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={280}
            aria-invalid={invalid}
            aria-describedby="escalate-reason-help"
            placeholder="Why is this alert being escalated?"
            className={cn(
              "mt-1.5 block w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus-visible:ring-2",
              invalid
                ? "border-[#e7b7b7] focus-visible:ring-[#c62828]"
                : "border-[var(--border)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]",
            )}
          />
          <p
            id="escalate-reason-help"
            className={cn("mt-1.5 text-[12px]", invalid ? "text-[#991b1b]" : "text-[var(--muted-foreground)]")}
          >
            {invalid ? "Enter a reason before escalating." : "Required. Recorded verbatim in the alert history."}
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            Escalate alert
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  if (!message) return null;
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-[13px] font-medium text-[var(--foreground)] shadow-[0_10px_30px_rgba(17,24,39,0.12)]"
    >
      {isError ? (
        <AlertCircle className="h-[18px] w-[18px] shrink-0 text-[#c62828]" strokeWidth={2} />
      ) : (
        <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-[var(--primary)]" strokeWidth={2} />
      )}
      {message}
    </div>
  );
}
