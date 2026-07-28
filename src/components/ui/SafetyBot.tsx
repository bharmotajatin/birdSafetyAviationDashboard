"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BirdFlightMark } from "@/components/dashboard/BirdFlightLogo";
import { SafetyBotMessage } from "@/components/ui/safety-bot/SafetyBotMessage";
import { askGroq, AskGroqError, trimConversationMessages } from "@/lib/safety-bot/askGroq";
import {
  buildBotSystemPromptPreview,
  buildContextBannerText,
  buildSheetContextRows,
} from "@/lib/safety-bot/botContext";
import { buildSystemPrompt } from "@/lib/safety-bot/buildSystemPrompt";
import { navigateFiltersForQuestion } from "@/lib/safety-bot/navigateFilters";
import {
  naturalQueryToRows,
  parseNaturalQuery,
} from "@/lib/safety-bot/parseNaturalQuery";
import { parseAIResponse } from "@/lib/safety-bot/parseAIResponse";
import { pickRotatedQuestions, QUICK_QUESTIONS } from "@/lib/safety-bot/questions";
import { useErrorMonitorStore } from "@/lib/stores/error-monitor-store";
import { getQuestionPreviewSubtitle } from "@/lib/safety-bot/questionPreviews";
import {
  getProactiveAlerts,
  markProactiveAlertsShown,
  shouldShowProactiveAlerts,
} from "@/lib/safety-bot/proactiveAlerts";
import type { BotAnswer, ChatMessage, SessionExchange } from "@/lib/safety-bot/types";
import type { IncidentLogBotFilters } from "@/lib/safety-bot/incident-log-nav";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import type { DashboardData, Incident } from "@/lib/types";

const SESSION_SEED_KEY = "bfs-safety-bot-seed";
const BANNER_COLLAPSED_KEY = "bfs_bot_banner_collapsed";
const MAX_PAIRS = 10;
const INPUT_MAX = 200;
const PLACEHOLDERS = [
  "Ask about incidents, risk, trends…",
  "Try: which month was most dangerous?",
  "Try: show me all open CAT-A cases",
] as const;

function getSessionSeed() {
  if (typeof window === "undefined") return 42;
  const existing = sessionStorage.getItem(SESSION_SEED_KEY);
  if (existing) return Number(existing);
  const seed = Math.floor(Math.random() * 1_000_000);
  sessionStorage.setItem(SESSION_SEED_KEY, String(seed));
  return seed;
}

function pageContextNote(
  pathname: string,
  data: DashboardData,
  graphStation: string,
  graphMonth: string,
  graphYear: string,
) {
  if (pathname.startsWith("/station-analysis")) {
    return `Context: Station Analysis view — using active station filter ${graphStation}.`;
  }
  if (pathname.startsWith("/monthly")) {
    const range = data.monthlyTrend.map((m) => m.label).join(", ") || "no months";
    return `Context: Monthly view — trend covers ${range}.`;
  }
  if (pathname.startsWith("/graphs")) {
    return `Context: Graphs filters — station ${graphStation}, year ${graphYear}, month ${graphMonth}.`;
  }
  if (pathname.startsWith("/pan-india")) {
    return "Context: Pan India overview — all stations in scope.";
  }
  if (pathname.startsWith("/incident-log")) {
    return "Context: Incident Log — full searchable list.";
  }
  return "Context: Dashboard overview.";
}

function botMessageFromAnswer(
  answer: BotAnswer,
  matchedIncidents: Incident[],
  contextNote?: string,
  navigateFilters?: IncidentLogBotFilters,
  questionId?: string,
): ChatMessage {
  return {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: "bot",
    summary: answer.summary,
    rows: answer.rows,
    matchedCount: matchedIncidents.length,
    matchedIncidents,
    questionId,
    contextNote,
    navigateFilters,
  };
}

function botMessageFromNatural(
  summary: string,
  rows: { label: string; value: string; highlight?: boolean }[],
  matchedIncidents: Incident[],
  contextNote?: string,
  filterDescription?: string,
  navigateFilters?: IncidentLogBotFilters,
  extras?: { error?: string; retryQuery?: string },
): ChatMessage {
  return {
    id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: "bot",
    summary,
    rows,
    matchedCount: matchedIncidents.length,
    matchedIncidents,
    filterDescription,
    contextNote,
    navigateFilters,
    error: extras?.error,
    retryQuery: extras?.retryQuery,
  };
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.classList.contains("dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function useWindowSize() {
  const [size, setSize] = useState({ width: 1280, height: 800 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

function getBasePanelDimensions(viewportWidth: number, viewportHeight: number) {
  if (viewportWidth < 768) {
    return {
      width: viewportWidth - 24,
      height: viewportHeight - 100,
      bottom: 80,
      right: 12,
    };
  }
  if (viewportWidth < 1024) {
    return { width: 420, height: 600, bottom: 88, right: 24 };
  }
  return { width: 480, height: 680, bottom: 88, right: 24 };
}

function clampPanelSize(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return {
    width: Math.min(width, viewportWidth - 32),
    height: Math.min(height, viewportHeight - 120),
  };
}

export function SafetyBot() {
  const pathname = usePathname();
  const data = useDashboardStore((s) => s.data);
  const fileName = useDashboardStore((s) => s.fileName);
  const graphFilters = useDashboardStore((s) => s.graphFilters);
  const isDark = useDarkMode();

  const windowSize = useWindowSize();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelView, setPanelView] = useState<"chat" | "history">("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<SessionExchange[]>([]);
  const [hasNewAnswer, setHasNewAnswer] = useState(false);
  const [rotatedQuestions, setRotatedQuestions] = useState<typeof QUICK_QUESTIONS>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bannerExpanded, setBannerExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(BANNER_COLLAPSED_KEY) === "0";
  });
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [fabTooltipVisible, setFabTooltipVisible] = useState(false);
  const fabTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [proactiveAlerts, setProactiveAlerts] = useState<{ id: string; message: string }[]>([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [voiceSupported] = useState(() =>
    typeof window !== "undefined"
      ? Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
      : false,
  );
  const [voiceTooltip, setVoiceTooltip] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const stationLabel =
    graphFilters.station !== "All" ? graphFilters.station : data?.bestStation ?? "All stations";
  const incidentCount = data?.incidents.length ?? 0;
  const kpis = data?.kpis;

  const openPanel = useCallback(() => {
    setHasNewAnswer(false);
    setRotatedQuestions(pickRotatedQuestions(getSessionSeed(), 6));
    if (data && shouldShowProactiveAlerts()) {
      setProactiveAlerts(getProactiveAlerts(data));
      markProactiveAlertsShown();
    }
    setOpen(true);
    setMinimized(false);
    setPanelView("chat");
  }, [data]);

  const refreshSuggestions = () => {
    setRotatedQuestions(pickRotatedQuestions(Math.floor(Math.random() * 1_000_000), 6));
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, panelView]);

  useEffect(() => {
    if (!open || input.trim() || isProcessing) return;
    const t = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => window.clearInterval(t);
  }, [open, input, isProcessing]);

  const contextNote = useMemo(() => {
    if (!data) return "Upload a workbook to enable live answers.";
    return pageContextNote(pathname, data, graphFilters.station, graphFilters.month, graphFilters.year);
  }, [pathname, data, graphFilters]);

  const contextBanner = useMemo(() => {
    if (!data) return "";
    return buildContextBannerText(data, pathname, graphFilters, 7);
  }, [data, pathname, graphFilters]);

  const systemPromptPreview = useMemo(() => {
    if (!data) return "";
    return buildBotSystemPromptPreview(data, pathname, graphFilters, fileName);
  }, [data, pathname, graphFilters, fileName]);

  const sheetRows = useMemo(() => (data ? buildSheetContextRows(data) : []), [data]);

  const pushPair = useCallback(
    (userText: string, bot: ChatMessage) => {
      setMessages((prev) => {
        const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", text: userText };
        const next = [...prev, userMsg, bot];
        const pairs = Math.floor(next.length / 2);
        const trimmed = pairs <= MAX_PAIRS ? next : next.slice(next.length - MAX_PAIRS * 2);
        setHistory((h) => [
          ...h,
          {
            id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            question: userText,
            preview: bot.role === "bot" ? bot.summary.slice(0, 30) : "",
            timestamp: Date.now(),
            messageCount: trimmed.length,
          },
        ]);
        return trimmed;
      });
      if (!open) setHasNewAnswer(true);
    },
    [open],
  );

  const closePanel = useCallback(() => {
    setOpen(false);
    setMinimized(false);
  }, []);

  const handleQuickQuestion = (questionId: string) => {
    if (!data) return;
    setIsProcessing(true);
    const q = QUICK_QUESTIONS.find((item) => item.id === questionId);
    if (!q) {
      setIsProcessing(false);
      return;
    }
    const answer = q.answer(data);
    const matched = matchQuickQuestionIncidents(q.id, data);
    const navFilters = navigateFiltersForQuestion(q.id);
    const bot = botMessageFromAnswer(
      answer,
      matched,
      contextNote,
      Object.keys(navFilters).length > 0 ? navFilters : undefined,
      q.id,
    );
    pushPair(q.fullQuery, bot);
    window.setTimeout(() => setIsProcessing(false), 120);
  };

  const handleSend = useCallback(async (overrideQuery?: string) => {
    const query = (overrideQuery ?? input).trim();
    if (!query || !data) return;
    if (!overrideQuery) setInput("");
    setIsProcessing(true);

    const runLocal = () => {
      const result = parseNaturalQuery(query, data.incidents);
      if (result.matchedIncidents.length === 0) {
        const bot = botMessageFromNatural(
          "I couldn't find matching incidents — try rephrasing or use one of the suggested questions below.",
          [{ label: "Query", value: query }],
          [],
          contextNote,
          result.filterDescription,
          result.navigateFilters,
        );
        pushPair(query, bot);
        return;
      }
      const rows = [
        ...naturalQueryToRows(result),
        { label: "Sample", value: result.matchedIncidents[0]?.title ?? "—" },
      ];
      const bot = botMessageFromNatural(
        result.summary,
        rows,
        result.matchedIncidents,
        contextNote,
        result.filterDescription,
        result.navigateFilters,
      );
      pushPair(query, bot);
    };

    try {
      const system = buildSystemPrompt(data, pathname, graphFilters, fileName);
      const priorMessages = trimConversationMessages(
        messages
          .filter((m): m is Extract<ChatMessage, { role: "user" } | { role: "bot" }> =>
            m.role === "user" || m.role === "bot",
          )
          .map((m) =>
            m.role === "user"
              ? { role: "user" as const, content: m.text }
              : { role: "assistant" as const, content: m.summary },
          ),
      );
      const { text } = await askGroq({
        system,
        messages: [...priorMessages, { role: "user", content: query }],
      });

      const parsed = parseAIResponse(text, data.incidents);
      const localResult = parseNaturalQuery(query, data.incidents);
      const matched =
        parsed.useIncidentList && parsed.extractedIncidents.length > 0
          ? parsed.extractedIncidents
          : localResult.matchedIncidents;
      const summary = parsed.summaryText.trim() || text;
      const rows = [
        ...naturalQueryToRows({
          ...localResult,
          matchedIncidents: matched,
          summary,
        }),
      ];
      const bot = botMessageFromNatural(
        summary,
        rows,
        matched,
        contextNote,
        localResult.filterDescription,
        localResult.navigateFilters,
      );
      pushPair(query, bot);
    } catch (err) {
      if (err instanceof AskGroqError && err.status === 503) {
        runLocal();
      } else {
        const message =
          err instanceof AskGroqError
            ? err.userMessage
            : "Could not get a response. Please try again.";
        useErrorMonitorStore.getState().addError({
          source: "AISafetyBot",
          message: err instanceof Error ? err.message : message,
        });
        const bot = botMessageFromNatural(
          message,
          [],
          [],
          contextNote,
          undefined,
          undefined,
          { error: message, retryQuery: query },
        );
        pushPair(query, bot);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [contextNote, data, fileName, graphFilters, input, messages, pathname, pushPair]);

  useEffect(() => {
    const onBotSubmit = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      const query = detail?.query?.trim();
      if (!query || !data) return;
      openPanel();
      setInput(query);
      window.setTimeout(() => {
        void handleSend(query);
      }, 80);
    };

    window.addEventListener("safety-bot-submit", onBotSubmit);
    return () => window.removeEventListener("safety-bot-submit", onBotSubmit);
  }, [data, openPanel, handleSend]);

  const restoreExchange = (entry: SessionExchange) => {
    setMessages((prev) => prev.slice(0, entry.messageCount));
    setPanelView("chat");
  };

  const clearHistory = () => {
    setHistory([]);
    setMessages([]);
    setProactiveAlerts([]);
  };

  const startVoiceInput = () => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceTooltip(true);
      window.setTimeout(() => setVoiceTooltip(false), 2500);
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setInput((prev) => `${prev} ${text}`.trim().slice(0, INPUT_MAX));
    };
    rec.onerror = () => setVoiceTooltip(true);
    recognitionRef.current = rec;
    rec.start();
  };

  const charCount = input.length;
  const counterClass =
    charCount >= 190
      ? "text-red-400"
      : charCount >= 150
        ? "text-amber-400"
        : "safety-bot-muted";

  const userQuestionForBot = (botId: string) => {
    const idx = messages.findIndex((m) => m.id === botId);
    if (idx <= 0) return "";
    const prev = messages[idx - 1];
    return prev?.role === "user" ? prev.text : "";
  };

  const toggleBanner = () => {
    setBannerExpanded((prev) => {
      const next = !prev;
      sessionStorage.setItem(BANNER_COLLAPSED_KEY, next ? "0" : "1");
      return next;
    });
  };

  const panelLayout = useMemo(() => {
    const { width: vw, height: vh } = windowSize;
    if (fullscreen) {
      return {
        width: vw - 48,
        height: vh - 48,
        bottom: undefined as number | undefined,
        right: 24,
        top: 24,
        left: 24,
      };
    }
    const base = getBasePanelDimensions(vw, vh);
    const clamped = clampPanelSize(base.width, base.height, vw, vh);
    const panelRight = Math.min(24, Math.max(12, vw - clamped.width - 12));
    return {
      width: clamped.width,
      height: minimized ? undefined : clamped.height,
      bottom: base.bottom,
      right: vw < 768 ? base.right : panelRight,
      top: undefined as number | undefined,
      left: undefined as number | undefined,
    };
  }, [windowSize, fullscreen, minimized]);

  const showFabTooltip = () => {
    if (fabTooltipTimerRef.current) clearTimeout(fabTooltipTimerRef.current);
    fabTooltipTimerRef.current = setTimeout(() => setFabTooltipVisible(true), 600);
  };

  const hideFabTooltip = () => {
    if (fabTooltipTimerRef.current) clearTimeout(fabTooltipTimerRef.current);
    setFabTooltipVisible(false);
  };

  return (
    <>
      <div
        className="fixed z-[9998]"
        style={{ bottom: 24, right: 24 }}
        onMouseEnter={showFabTooltip}
        onMouseLeave={hideFabTooltip}
      >
        {fabTooltipVisible ? (
          <span className="safety-bot-fab-tooltip">Safety AI Assistant</span>
        ) : null}
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPanel())}
          aria-label="Open Safety Assistant"
          className={`safety-bot-fab relative flex items-center justify-center rounded-full border-2 border-[#d4af37] bg-[#1a2a5e] text-[#d4af37] shadow-lg transition hover:scale-105 ${
            hasNewAnswer ? "safety-bot-pulse" : ""
          }`}
        >
          <ShieldCheck size={22} aria-hidden />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`safety-bot-panel safety-bot-root fixed z-[9997] rounded-2xl border border-[#1a2a5e] shadow-[0_20px_60px_rgba(0,0,0,0.15)] ${
              isDark ? "dark safety-bot-dark" : "bg-white"
            } ${minimized ? "safety-bot-minimized" : ""} ${fullscreen ? "safety-bot-fullscreen" : ""}`}
            style={{
              width: panelLayout.width,
              height: panelLayout.height,
              bottom: panelLayout.bottom,
              right: panelLayout.right,
              top: panelLayout.top,
              left: panelLayout.left,
            }}
          >
            <header className="safety-bot-header flex flex-col bg-[#1a2a5e] text-white">
              <div className="flex items-center gap-2 px-3 py-2">
                <BirdFlightMark size={32} className="shadow-sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Safety Assistant</p>
                  <p className="truncate text-[10px] text-white/70">
                    {stationLabel} · {incidentCount} incidents
                  </p>
                </div>
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                <button
                  type="button"
                  onClick={() => setPanelView((v) => (v === "history" ? "chat" : "history"))}
                  className="rounded p-1 text-white/70 hover:bg-white/10"
                  aria-label="Conversation history"
                >
                  <Clock size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFullscreen((f) => !f);
                    setMinimized(false);
                  }}
                  className="rounded p-1 text-white/70 hover:bg-white/10"
                  aria-label={fullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
                >
                  {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setMinimized((m) => !m)}
                  className="rounded p-1 text-white/70 hover:bg-white/10"
                  aria-label={minimized ? "Restore panel" : "Minimize panel"}
                >
                  <Minus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-1 text-white/70 hover:bg-white/10"
                  aria-label="Close assistant"
                >
                  <X size={16} />
                </button>
              </div>
              {kpis && data ? (
                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ background: "rgba(239,68,68,0.2)", color: "#fca5a5" }}
                  >
                    🔴 {kpis.open} Open
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ background: "rgba(212,175,55,0.2)", color: "#d4af37" }}
                  >
                    ⚠ {kpis.catA} CAT-A
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ background: "rgba(34,197,94,0.2)", color: "#86efac" }}
                  >
                    ✅ {kpis.closureRate}%
                  </span>
                </div>
              ) : null}
            </header>

            {!minimized && data ? (
              <div
                className={`safety-bot-banner flex items-center gap-2 px-4 text-[10px] ${
                  bannerExpanded ? "safety-bot-banner--expanded py-2" : "safety-bot-banner--collapsed py-1"
                }`}
              >
                <p className="safety-bot-text min-w-0 flex-1 truncate leading-tight">{contextBanner}</p>
                {bannerExpanded ? (
                  <>
                    <div className="group relative shrink-0">
                      <Info size={12} className="safety-bot-muted cursor-help" />
                      <div className="pointer-events-none absolute right-0 top-5 z-10 hidden w-48 rounded-lg border border-[#d4af37]/30 bg-[var(--background)] p-2 text-[9px] shadow-lg group-hover:block">
                        {sheetRows.map((s) => (
                          <p key={s.name} className="safety-bot-muted">
                            {s.name}: {s.rows} rows
                          </p>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContextModalOpen(true)}
                      className="shrink-0 text-[#d4af37] hover:underline"
                    >
                      Expand context
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={toggleBanner}
                  className="shrink-0 safety-bot-muted"
                  aria-label={bannerExpanded ? "Collapse context banner" : "Expand context banner"}
                >
                  {bannerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            ) : null}

            {!minimized ? (
              <div className="safety-bot-main">
                <div className="safety-bot-messages-wrap">
                  <div
                    className="safety-bot-messages-slide"
                    style={{
                      width: "200%",
                      transform: panelView === "history" ? "translateX(-50%)" : "translateX(0)",
                    }}
                  >
                    <div ref={scrollRef} className="safety-bot-messages-scroll">
                      {!data ? (
                        <p className="p-4 text-sm safety-bot-muted">
                          Upload a workbook to ask safety questions with live data.
                        </p>
                      ) : (
                        <div className="safety-bot-messages-list">
                          {proactiveAlerts.map((alert) => (
                            <div
                              key={alert.id}
                              className="rounded-lg px-3.5 py-2.5 text-[12px]"
                              style={{
                                background: "rgba(239,68,68,0.08)",
                                borderLeft: "3px solid #ef4444",
                              }}
                            >
                              {alert.message}
                            </div>
                          ))}
                          {messages.map((msg) =>
                            msg.role === "user" ? (
                              <div key={msg.id} className="flex justify-end">
                                <div className="msg-bubble-user">
                                  <p>{msg.text}</p>
                                </div>
                              </div>
                            ) : (
                              <SafetyBotMessage
                                key={msg.id}
                                msg={msg}
                                data={data}
                                userQuestion={userQuestionForBot(msg.id)}
                                onClosePanel={closePanel}
                                onRetry={(q) => void handleSend(q)}
                              />
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    <div className="safety-bot-history-pane flex flex-col">
                      <p className="mb-2 shrink-0 text-xs font-semibold safety-bot-text">Session history</p>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                        {history.length === 0 ? (
                          <p className="text-[11px] safety-bot-muted">No questions yet this session.</p>
                        ) : (
                          [...history].reverse().map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => restoreExchange(entry)}
                              className="w-full rounded-lg border border-[#d4af37]/20 p-2 text-left text-[10px] hover:border-[#d4af37]/50"
                            >
                              <p className="safety-bot-text line-clamp-1 font-medium">
                                {entry.question.slice(0, 50)}
                                {entry.question.length > 50 ? "…" : ""}
                              </p>
                              <p className="safety-bot-muted mt-0.5">
                                {new Date(entry.timestamp).toLocaleTimeString()} · {entry.preview}…
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={clearHistory}
                        className="mt-2 shrink-0 text-[10px] text-red-400 hover:underline"
                      >
                        Clear history
                      </button>
                    </div>
                  </div>
                </div>

                {data && panelView === "chat" ? (
                  <div className="safety-bot-suggestions">
                    <div className="flex items-center justify-between px-4 pt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide safety-bot-muted">
                        Suggested questions
                      </p>
                      <button
                        type="button"
                        onClick={refreshSuggestions}
                        className="rounded p-0.5 safety-bot-muted hover:text-[#d4af37]"
                        aria-label="Refresh suggestions"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                    <div className="safety-bot-suggestions-grid">
                      {rotatedQuestions.map((q, index) => (
                        <QuickChip
                          key={`${q.id}-${index}`}
                          icon={q.icon}
                          label={q.label}
                          subtitle={getQuestionPreviewSubtitle(q.id, data)}
                          onClick={() => handleQuickQuestion(q.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {panelView === "chat" ? (
                  <div className="safety-bot-input-row">
                <div className="mb-1 flex justify-end">
                  <span className={`text-[10px] ${counterClass}`}>
                    {charCount}/{INPUT_MAX}
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value.slice(0, INPUT_MAX))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSend();
                      }}
                      placeholder=""
                      disabled={!data || isProcessing}
                      className="theme-input w-full rounded-lg px-3 py-2 text-sm"
                    />
                    {!input.trim() && !isProcessing && data ? (
                      <span
                        key={placeholderIndex}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm safety-bot-placeholder transition-opacity duration-400"
                      >
                        {PLACEHOLDERS[placeholderIndex]}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={startVoiceInput}
                      disabled={!data}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#1a2a5e]/20 safety-bot-muted disabled:opacity-40"
                      aria-label="Voice input"
                    >
                      <Mic size={16} />
                    </button>
                    {voiceTooltip && !voiceSupported ? (
                      <span className="absolute bottom-11 right-0 z-10 w-36 rounded bg-[#1a2a5e] px-2 py-1 text-[9px] text-white">
                        Voice input not supported in this browser
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!data || !input.trim() || isProcessing}
                    className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1a2a5e] text-[#d4af37] disabled:opacity-40 ${
                      isProcessing ? "safety-bot-pulse" : ""
                    }`}
                    aria-label="Send"
                  >
                    <Send size={18} />
                    <span className="absolute -right-1 -top-1 rounded bg-[#d4af37] px-0.5 text-[7px] font-bold text-[#1a2a5e]">
                      AI
                    </span>
                  </button>
                </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {contextModalOpen && data ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal
        >
          <div className="safety-bot-root max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl border border-[#d4af37]/40 bg-white dark:bg-[#0f1629]">
            <div className="flex items-center justify-between bg-[#1a2a5e] px-4 py-2 text-white">
              <p className="text-sm font-semibold">System context</p>
              <button type="button" onClick={() => setContextModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <pre className="max-h-[60vh] overflow-auto p-4 text-[10px] safety-bot-text whitespace-pre-wrap">
              {systemPromptPreview}
            </pre>
          </div>
        </div>
      ) : null}
    </>
  );
}

function matchQuickQuestionIncidents(questionId: string, data: DashboardData): Incident[] {
  switch (questionId) {
    case "cat-a-count":
      return data.incidents.filter((i) => i.category === "CAT-A");
    case "cat-b-count":
      return data.incidents.filter((i) => i.category === "CAT-B");
    case "near-miss":
      return data.incidents.filter((i) => i.incidentType.toLowerCase().includes("near miss"));
    case "open-incidents":
      return data.incidents.filter((i) => i.status === "Open");
    case "pending-count":
      return data.incidents.filter((i) => i.status === "Pending");
    case "staff-injuries-2025":
      return data.incidents.filter(
        (i) =>
          i.incidentType.toLowerCase().includes("staff injury") && i.monthKey.startsWith("2025"),
      );
    case "del-risk":
      return data.incidents.filter((i) => i.station === "DEL");
    case "ramp-incidents":
      return data.incidents.filter((i) => i.department === "RAMP");
    case "cargo-dept":
      return data.incidents.filter((i) => i.department === "CARGO");
    case "gse-incidents":
      return data.incidents.filter((i) => i.incidentType.toLowerCase().includes("gse"));
    case "loading-errors":
      return data.incidents.filter((i) => i.incidentType.toLowerCase().includes("loading"));
    case "closed-count":
      return data.incidents.filter((i) => i.status === "Closed");
    case "in-progress-count":
      return data.incidents.filter((i) => i.status === "In Progress");
    default:
      return data.incidents;
  }
}

function QuickChip({
  icon: Icon,
  label,
  subtitle,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="safety-bot-quick-chip">
      <div className="flex items-start gap-1.5">
        <Icon size={14} className="mt-0.5 shrink-0 text-[#d4af37]" aria-hidden />
        <div className="min-w-0 flex-1">
          <span className="safety-bot-quick-chip-label block">{label}</span>
          <span className="safety-bot-quick-chip-subtitle block">{subtitle}</span>
        </div>
      </div>
    </button>
  );
}

// Web Speech API
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEvent = {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}
