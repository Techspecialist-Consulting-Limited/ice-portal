"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({ userName }: { userName: string }) {
  const [greeting, setGreeting] = useState("");
  const [dateTime, setDateTime] = useState("");

  useEffect(() => {
    setGreeting(getGreeting());

    const updateDateTime = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
      setDateTime(`${dateStr}, ${timeStr}`);
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const firstName = userName.split(" ")[0];

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[17px] font-semibold text-[var(--foreground)]">
          {greeting}, {firstName}
        </p>
        <h1 className="mt-1 text-[32px] font-semibold leading-10 tracking-tight text-[var(--foreground)]">
          Portal overview
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--muted-foreground)]">
          Manage portal accounts, roles, and access across the organization.
        </p>
      </div>
      <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2">
        <Calendar className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
        <div className="text-right">
          <p className="text-[11px] font-medium text-[var(--foreground)]">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
          </p>
          <p className="text-[10px] text-[var(--muted-foreground)]">
            {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
          </p>
        </div>
      </div>
    </div>
  );
}
