import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import { ThemeScript } from "@/components/providers/ThemeScript";
import { SafetyBot } from "@/components/ui/SafetyBot";
import "./globals.css";

export const metadata: Metadata = {
  title: "Safety Incident Dashboard",
  description: "Enterprise aviation safety incident tracking system",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased"
      >
        <AppProviders>
          {children}
          <SafetyBot />
        </AppProviders>
      </body>
    </html>
  );
}
