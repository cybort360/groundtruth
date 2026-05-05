import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { seedFallbackData } from "@/lib/demo-seed";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GroundTruth — Offline Situational Awareness",
  description:
    "AI-powered situational awareness that reasons over conflicting reports to tell you what is actually happening.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GroundTruth",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Seed demo data on every server-side render.
  // Runs in the Next.js server component context (request time, not build time),
  // so the DB is populated before the client makes its first API call.
  // isAlreadySeeded() makes this a no-op on warm instances.
  try { seedFallbackData(); } catch { /* DB unavailable during static analysis — skip */ }

  return (
    <html lang="en">
      <head>
        {/* Fallback for older Safari / standalone mode */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans bg-slate-50 text-slate-900 antialiased`}>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
