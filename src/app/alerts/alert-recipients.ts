import type { AlertItem } from "@/app/dashboard/mock-data";

export type RecipientAcknowledgementStatus = "Acknowledged" | "Outstanding";

export type AlertRecipient = {
  id: string;
  name: string;
  department: string;
  location: string;
  status: RecipientAcknowledgementStatus;
  acknowledgedAt?: string;
  escalated: boolean;
  escalatedAt?: string;
  escalationReason?: string;
};

export type RecipientTotals = {
  total: number | null;
  acknowledged: number | null;
  outstanding: number | null;
  escalated: number;
  rate: number | null;
};

// The current alert model stores aggregate acknowledgement counts only. It has
// no recipient-level records, so a roster cannot be derived without inventing
// identities and event states.
export function buildAlertRecipients(_alert: AlertItem): AlertRecipient[] {
  void _alert;
  return [];
}

export function recipientTotals(recipients: AlertRecipient[]): RecipientTotals {
  const total = recipients.length;
  const acknowledged = recipients.filter((recipient) => recipient.status === "Acknowledged").length;
  const escalated = recipients.filter((recipient) => recipient.escalated).length;
  return {
    total,
    acknowledged,
    outstanding: total - acknowledged,
    escalated,
    rate: total === 0 ? null : (acknowledged / total) * 100,
  };
}

export function alertAggregateRecipientTotals(alert: AlertItem): RecipientTotals {
  if (!alert.acknowledgementRequired) {
    return { total: 0, acknowledged: 0, outstanding: 0, escalated: 0, rate: null };
  }

  const target = alert.acknowledgementTargetCount;
  const responses = alert.acknowledgedCount;
  const total = target === undefined ? null : Math.max(0, target);
  const acknowledged = responses === undefined
    ? null
    : Math.max(0, total === null ? responses : Math.min(total, responses));
  const outstanding = total === null || acknowledged === null ? null : total - acknowledged;
  return {
    total,
    acknowledged,
    outstanding,
    escalated: 0,
    rate: total === null || acknowledged === null || total === 0 ? null : (acknowledged / total) * 100,
  };
}

export function recipientOperationalRank(recipient: AlertRecipient): number {
  if (recipient.escalated) return 0;
  if (recipient.status === "Outstanding") return 1;
  return 2;
}
