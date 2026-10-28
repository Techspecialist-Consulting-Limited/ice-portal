"use client";

import Image from "next/image";
import { MapPin, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { IncidentType } from "../dashboard/mock-data";
import { isIncidentType } from "./incident-status";

const MAP_ASSETS = {
  SOS: [
    "/assets/28.10.2026_09.55.03_REC.png",
    "/assets/28.10.2026_09.56.15_REC.png",
  ],
  "Emergency Report": [
    "/assets/28.10.2026_09.56.44_REC.png",
    "/assets/28.10.2026_09.57.35_REC.png",
  ],
  "Incident Report": [
    "/images/incident-maps/incident-report-map-01.svg",
    "/images/incident-maps/incident-report-map-02.svg",
  ],
} satisfies Record<IncidentType, readonly [string, string]>;

export function selectMapVariant(incidentId: string, incidentType: IncidentType): string {
  const assets = MAP_ASSETS[incidentType];
  const hash = Array.from(incidentId).reduce((value, char) => value + char.charCodeAt(0), 0);
  return assets[hash % assets.length];
}

interface IncidentMapBannerProps {
  incidentId: string;
  incidentType?: IncidentType | string | null;
  location?: string | null;
  floorArea?: string | null;
}

export function IncidentMapBanner({ incidentId, incidentType, location, floorArea }: IncidentMapBannerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [failedMapSrc, setFailedMapSrc] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mapSrc = isIncidentType(incidentType) ? selectMapVariant(incidentId, incidentType) : null;
  const displayLocation = [location?.trim(), floorArea?.trim()].filter(Boolean).join(" · ") || "Location not provided";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isModalOpen && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!isModalOpen && dialog.open) {
      dialog.close();
    }
  }, [isModalOpen]);

  if (!mapSrc || failedMapSrc === mapSrc) {
    return (
      <div className="flex h-[160px] items-center justify-center rounded-[16px] border border-[var(--border)] bg-[var(--muted)] md:h-[200px]">
        <div className="text-center">
          <MapPin aria-hidden="true" className="mx-auto h-8 w-8 text-[var(--muted-foreground)]" strokeWidth={2} />
          <p className="mt-2 text-sm font-medium text-[var(--foreground)]">Location preview unavailable</p>
          <p className="mt-1 text-[12px] text-[var(--muted-foreground)]">
            Reported location: {displayLocation}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="relative block h-[160px] w-full overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--muted)] shadow-[var(--shadow-soft)] transition-colors hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] md:h-[200px]"
        aria-label={`View larger illustrative map for ${displayLocation}`}
      >
        <Image
          src={mapSrc}
          alt={`Illustrative ${incidentType} map preview for incident ${incidentId}; it is not verified against the reported location and does not show live location.`}
          fill
          sizes="(min-width: 1830px) 1552px, (min-width: 768px) calc(100vw - 278px), calc(100vw - 32px)"
          loading="eager"
          unoptimized={mapSrc.endsWith(".svg")}
          onError={() => {
            setFailedMapSrc(mapSrc);
            setIsModalOpen(false);
          }}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span aria-hidden="true" className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--primary)] p-2 text-white shadow-lg ring-4 ring-white/70">
          <MapPin className="h-7 w-7" strokeWidth={2.2} />
        </span>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white">
          <MapPin aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
          <div className="text-left">
            <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">Reported location</p>
            <p className="max-w-[min(70vw,36rem)] truncate text-sm font-semibold">{displayLocation}</p>
          </div>
        </div>
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-[var(--foreground)] backdrop-blur-sm shadow-sm">
            <Maximize2 aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            <span>View larger map</span>
          </div>
        </div>
        <span className="absolute bottom-2 right-3 rounded bg-black/45 px-2 py-1 text-[10px] text-white">
          Preview only — not live or location-verified
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="map-modal-title"
        onClose={() => setIsModalOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          setIsModalOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setIsModalOpen(false);
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-auto border-0 bg-black/80 p-4 backdrop:bg-black/80"
      >
        <div
          className="flex min-h-full items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) dialogRef.current?.close();
          }}
        >
          <section className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <h2 id="map-modal-title" className="text-lg font-semibold text-[var(--foreground)]">
                Illustrative location preview
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                aria-label="Close map preview"
              >
                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="relative aspect-[16/9] w-full bg-[var(--muted)] sm:aspect-[16/7]">
              <Image
                src={mapSrc}
                alt={`Enlarged illustrative ${incidentType} map preview; it is not verified against the reported location and does not show live location.`}
                fill
                sizes="(min-width: 1184px) 1152px, calc(100vw - 32px)"
                unoptimized={mapSrc.endsWith(".svg")}
                onError={() => {
                  setFailedMapSrc(mapSrc);
                  setIsModalOpen(false);
                }}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <span aria-hidden="true" className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--primary)] p-2 text-white shadow-lg ring-4 ring-white/70">
                <MapPin className="h-9 w-9" strokeWidth={2.2} />
              </span>
              <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] items-center gap-2 text-white">
                <MapPin aria-hidden="true" className="h-6 w-6 shrink-0" strokeWidth={2} />
                <div className="text-left">
                  <p className="text-[12px] font-medium uppercase tracking-wider opacity-80">Reported location</p>
                  <p className="truncate text-base font-semibold">{displayLocation}</p>
                </div>
              </div>
            </div>
            <p className="px-4 py-3 text-[12px] text-[var(--muted-foreground)]">
              This map image is a visual preview only and is not verified for this incident; it does not provide live location data.
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
