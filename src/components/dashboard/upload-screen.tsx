"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Check,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BirdFlightLogo } from "@/components/dashboard/BirdFlightLogo";
import { UploadExcelIcon } from "@/components/dashboard/UploadExcelIcon";
import { UploadLoadingRadar } from "@/components/dashboard/UploadLoadingRadar";
import { WorkbookValidationPanel } from "@/components/dashboard/WorkbookValidationPanel";
import { REQUIRED_SHEET_SPECS } from "@/lib/validation/workbook";
import { useDashboardStore } from "@/lib/stores/dashboard-store";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const FEATURE_PILLS = [
  { icon: ShieldCheck, label: "Incident Validation" },
  { icon: BarChart3, label: "Live Analytics" },
  { icon: AlertTriangle, label: "Risk Intelligence" },
] as const;

const STAT_CARDS = [
  { label: "Incidents Tracked", value: "63" },
  { label: "Stations Monitored", value: "11" },
  { label: "Analysis Sheets", value: "6" },
  { label: "Risk Scoring", value: "Real-time" },
] as const;

const headerStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14 } },
};

const REQUIRED_SHEETS = REQUIRED_SHEET_SPECS.map((s) => s.label);

const GridScan = dynamic(
  () => import("@/components/effects/GridScan").then((m) => m.GridScan),
  { ssr: false },
);

function UploadLandingBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="upload-landing-bg pointer-events-none absolute inset-0" />
      <div className="upload-gridscan-layer absolute inset-0">
        <GridScan
          sensitivity={0.55}
          lineThickness={1}
          linesColor="#243666"
          gridScale={0.1}
          scanColor="#d4af37"
          scanOpacity={0.4}
          enablePost
          bloomIntensity={0.6}
          chromaticAberration={0.002}
          noiseIntensity={0.01}
          lineJitter={0.08}
          className="h-full w-full"
        />
      </div>
      <span className="upload-glow-orb upload-glow-orb--tr pointer-events-none" />
      <span className="upload-glow-orb upload-glow-orb--bl pointer-events-none" />
      <span className="upload-glow-orb upload-glow-orb--c pointer-events-none" />
      <span className="upload-radar-sweep pointer-events-none" />
      <div className="upload-landing-vignette pointer-events-none absolute inset-0" />
    </div>
  );
}

function SheetValidationStrip({
  validationReady,
  missingSheets,
}: {
  validationReady: boolean;
  missingSheets: string[];
}) {
  return (
    <motion.div
      custom={0.55}
      variants={{ hidden: fadeUp.hidden, visible: fadeUp.visible }}
      initial="hidden"
      animate="visible"
      className="upload-sheet-strip w-full"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-3 py-2">
        {REQUIRED_SHEETS.map((name, index) => {
          const ok = validationReady && !missingSheets.includes(name);
          return (
            <motion.span
              key={name}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={
                validationReady
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 1, scale: 1 }
              }
              transition={{ delay: validationReady ? index * 0.15 : 0, duration: 0.35 }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] sm:text-[11px] ${
                ok
                  ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                  : "upload-sheet-pill"
              }`}
            >
              {ok ? (
                <Check className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden />
              ) : (
                <Lock className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              )}
              <span className="whitespace-nowrap">{name}</span>
            </motion.span>
          );
        })}
      </div>
    </motion.div>
  );
}

export function UploadScreen() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [dragOver, setDragOver] = useState(false);
  const {
    loadWorkbook,
    isLoading,
    error,
    validation,
    confirmValidationAndLoad,
    dismissValidation,
    workbookLoaded,
  } = useDashboardStore();

  const isExcelFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith(".xlsx") || name.endsWith(".xls");
  };

  const onFile = async (file: File | undefined) => {
    if (!file || isLoading) return;
    if (!isExcelFile(file)) {
      useDashboardStore.setState({
        error: "Please upload a GHR Excel workbook (.xlsx or .xls only).",
      });
      return;
    }
    await loadWorkbook(file);
  };

  const handleTryAgain = () => {
    useDashboardStore.setState({ error: null });
    inputRef.current?.click();
  };

  const validationReady = Boolean(validation) || workbookLoaded;
  const missingSheets = useMemo(
    () => validation?.missingSheets ?? (workbookLoaded ? [] : REQUIRED_SHEETS),
    [validation, workbookLoaded],
  );

  const cardExpanded = Boolean(validation);

  return (
    <section className="upload-landing relative flex min-h-[calc(100vh-4rem)] w-full flex-col items-center overflow-x-hidden px-4 py-4 sm:py-5">
      <UploadLandingBackground />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center px-1 sm:px-2">
        {/* Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={headerStagger}
          className="flex flex-col items-center text-center"
        >
          <motion.div variants={{ hidden: fadeUp.hidden, visible: fadeUp.visible }} custom={0}>
            <BirdFlightLogo width={220} className="w-[min(220px,72vw)]" />
          </motion.div>
          <motion.div
            variants={{ hidden: fadeUp.hidden, visible: fadeUp.visible }}
            custom={0}
            className="mt-2 flex flex-col items-center"
          >
            <span className="h-0.5 w-[50px] bg-[#d4af37]" aria-hidden />
            <h1
              className="mt-2 text-center font-black tracking-[0.12em] text-white"
              style={{ fontSize: "clamp(1.2rem, 3.5vw, 2rem)" }}
            >
              SAFETY SHEET ANALYSER
            </h1>
          </motion.div>
          <motion.p
            variants={{ hidden: fadeUp.hidden, visible: fadeUp.visible }}
            custom={0}
            className="mt-1.5 max-w-xl text-center text-[0.75rem] tracking-[0.06em] text-[rgba(212,175,55,0.8)] sm:text-[0.8rem]"
          >
            Powered by Bird Flight Services · Aviation Ground Handling Intelligence
          </motion.p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1, delayChildren: 0.28 } },
          }}
          className="mt-3 flex flex-wrap items-center justify-center gap-2"
        >
          {FEATURE_PILLS.map(({ icon: Icon, label }) => (
            <motion.span
              key={label}
              variants={{ hidden: fadeUp.hidden, visible: fadeUp.visible }}
              custom={0}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.08)] px-3 py-1 text-[0.68rem] font-medium text-[#d4af37] sm:px-3.5 sm:py-1.5 sm:text-[0.72rem]"
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              {label}
            </motion.span>
          ))}
        </motion.div>

        {/* Main upload card */}
        <motion.div
          custom={0.35}
          variants={{ hidden: fadeUp.hidden, visible: fadeUp.visible }}
          initial="hidden"
          animate="visible"
          className={`mt-4 w-full ${cardExpanded ? "max-w-[50rem]" : "max-w-[420px]"}`}
        >
          <div
            className={`upload-glass-card upload-glass-card--compact w-full rounded-2xl border border-[rgba(212,175,55,0.3)] ${
              dragOver ? "upload-glass-card--drag" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void onFile(e.dataTransfer.files?.[0]);
            }}
          >
            {isLoading ? (
              <UploadLoadingRadar compact />
            ) : (
              <>
                <div
                  className={`upload-drop-inner upload-drop-inner--compact rounded-xl border-2 border-dashed border-[rgba(212,175,55,0.45)] transition-all duration-300 ${
                    dragOver ? "upload-drop-inner--drag border-solid" : ""
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <UploadExcelIcon size={36} />
                    <p className="mt-2 text-[0.9rem] font-semibold text-white sm:text-[0.95rem]">
                      Upload your GHR Excel workbook to begin
                    </p>
                    <p className="mt-0.5 text-[0.68rem] text-white/45 sm:text-[0.72rem]">
                      Supports .xlsx · .xls · Max 50MB
                    </p>
                  </div>
                </div>

                <div className="my-2.5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/15" />
                  <span className="text-xs font-medium uppercase tracking-wider text-white/35">
                    or
                  </span>
                  <span className="h-px flex-1 bg-white/15" />
                </div>

                {mounted ? (
                  <input
                    id={inputId}
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    suppressHydrationWarning
                    onChange={(e) => void onFile(e.target.files?.[0])}
                  />
                ) : null}

                <motion.label
                  htmlFor={mounted ? inputId : undefined}
                  aria-disabled={isLoading || !mounted}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="upload-choose-btn flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-extrabold text-[#1a2a5e] transition aria-disabled:pointer-events-none aria-disabled:opacity-60 sm:py-3 sm:text-base"
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
                  Choose Excel File
                </motion.label>
              </>
            )}

            {error ? (
              <div className="mt-5 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="mt-3 rounded-md border border-red-300/50 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-500/20"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {validation && !workbookLoaded ? (
              <div className="mt-6 text-left">
                <WorkbookValidationPanel
                  validation={validation}
                  isLoading={isLoading}
                  onLoadAnyway={() => void confirmValidationAndLoad()}
                  onDismiss={dismissValidation}
                />
              </div>
            ) : null}
          </div>
        </motion.div>

        {/* Stat cards */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.48 } },
          }}
          className="mt-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
        >
          {STAT_CARDS.map(({ label, value }) => (
            <motion.div
              key={label}
              variants={{ hidden: fadeUp.hidden, visible: fadeUp.visible }}
              custom={0}
              className="upload-stat-card rounded-lg px-2.5 py-2 sm:px-3 sm:py-2.5"
            >
              <p className="text-[8px] font-semibold uppercase leading-tight tracking-wider text-[rgba(212,175,55,0.7)] sm:text-[9px]">
                {label}
              </p>
              <p className="mt-0.5 text-sm font-bold text-white sm:text-base">{value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Sheet validation strip */}
        <div className="mt-3 w-full">
          <SheetValidationStrip
            validationReady={validationReady}
            missingSheets={missingSheets}
          />
        </div>

        {/* Footer */}
        <motion.footer
          custom={0.65}
          variants={{ hidden: fadeUp.hidden, visible: fadeUp.visible }}
          initial="hidden"
          animate="visible"
          className="mt-4 pb-2 text-center text-[0.65rem] font-bold text-white/90 sm:text-[0.7rem]"
        >
          Bird Flight Services · Ground Handling Safety Management System · Confidential
        </motion.footer>
      </div>
    </section>
  );
}
