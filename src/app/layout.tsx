import type { Metadata, Viewport } from "next";
import { AppProviders } from "@/components/providers/AppProviders";
import { ThemeScript } from "@/components/providers/ThemeScript";
import { BfsStorageHydrator } from "@/components/layout/BfsStorageHydrator";
import { DataFolderWatcher } from "@/components/layout/DataFolderWatcher";
import "./globals.css";

export const metadata: Metadata = {
  title: "Safety Sheet Analyser",
  description: "Excel-based aviation safety incident analysis dashboard",
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
          <BfsStorageHydrator />
          <DataFolderWatcher />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
