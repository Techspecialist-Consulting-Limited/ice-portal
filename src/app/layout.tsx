import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";
import { CurrentUserBoundary } from "./auth/current-user-boundary";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ICE 2.0 Incident Management Portal",
  description: "NSIA incident management and response portal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="min-h-dvh bg-[var(--page-bg)]" />}>
          <CurrentUserBoundary>{children}</CurrentUserBoundary>
        </Suspense>
      </body>
    </html>
  );
}
