"use client";

import { useEffect, useState } from "react";
import { Copy, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  detectResponseType,
  dashboardRouteForResponseType,
} from "@/lib/safety-bot/detectResponseType";
import { messageToCopyText, saveBotFeedback } from "@/lib/safety-bot/feedback";
import type { IncidentLogBotFilters } from "@/lib/safety-bot/incident-log-nav";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import type { ChatMessage } from "@/lib/safety-bot/types";
import type { DashboardData } from "@/lib/types";
import { SafetyBotResponseCards } from "./SafetyBotResponseCards";

const TYPE_INTERVAL_MS = 12;

type BotMsg = Extract<ChatMessage, { role: "bot" }>;

type Props = {
  msg: BotMsg;
  data: DashboardData;
  userQuestion: string;
  onClosePanel: () => void;
  onRetry: (query: string) => void;
};

export function SafetyBotMessage({ msg, data, userQuestion, onClosePanel, onRetry }: Props) {
  const router = useRouter();
  const setBotFilter = useDashboardStore((s) => s.setBotFilter);
  const setSelectedIncident = useDashboardStore((s) => s.setSelectedIncident);
  const fullText = msg.summary;
  const [displayText, setDisplayText] = useState("");
  const [streamDone, setStreamDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFeedbackMenu, setShowFeedbackMenu] = useState(false);

  useEffect(() => {
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setDisplayText(fullText.slice(0, i));
      if (i >= fullText.length) {
        window.clearInterval(timer);
        setStreamDone(true);
      }
    }, TYPE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [msg.id, fullText]);

  const matched = msg.matchedIncidents ?? [];
  const responseType = detectResponseType(fullText, {
    matchedCount: msg.matchedCount,
    questionId: msg.questionId,
  });

  const copyResponse = async () => {
    await navigator.clipboard.writeText(messageToCopyText(msg.summary, msg.rows));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const goDashboard = () => {
    const route = dashboardRouteForResponseType(responseType);
    if (route === "/incident-log" && msg.navigateFilters) {
      setBotFilter(msg.navigateFilters);
    }
    router.push(route);
    onClosePanel();
  };

  const goIncidentLog = (filters?: IncidentLogBotFilters) => {
    if (filters && Object.keys(filters).length > 0) {
      setBotFilter(filters);
    }
    router.push("/incident-log");
    onClosePanel();
  };

  return (
    <div className="flex gap-2" style={{ pointerEvents: "auto" }}>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a2a5e] text-[#d4af37]">
        <ShieldCheck size={14} aria-hidden />
      </div>
      <div className="msg-bubble-bot min-w-0 flex-1" style={{ pointerEvents: "auto" }}>
        {msg.contextNote ? (
          <p className="mb-1 text-[10px] safety-bot-muted">{msg.contextNote}</p>
        ) : null}
        <p className="safety-bot-text whitespace-pre-wrap">
          {displayText}
          {!streamDone ? <span className="safety-bot-cursor">|</span> : null}
        </p>
        {streamDone ? (
          <>
            <SafetyBotResponseCards
              type={responseType}
              summary={msg.summary}
              rows={msg.rows}
              data={data}
              matchedIncidents={matched}
              onIncidentClick={(incident) => {
                setSelectedIncident(incident);
                onClosePanel();
              }}
            />
            {msg.matchedCount > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goIncidentLog(msg.navigateFilters);
                }}
                className="safety-bot-view-incidents-link mt-2 text-[11px] font-semibold text-[#1a2a5e] transition-colors duration-150 hover:text-[#d4af37] hover:underline dark:text-[#d4af37]"
                style={{
                  cursor: "pointer",
                  pointerEvents: "auto",
                  zIndex: 10,
                  position: "relative",
                  background: "none",
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                View {msg.matchedCount} incidents in Incident Log →
              </button>
            ) : null}
            {msg.error ? (
              <div className="mt-2 rounded border border-red-400/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-600 dark:text-red-300">
                <p>{msg.error}</p>
                {msg.retryQuery ? (
                  <button
                    type="button"
                    onClick={() => msg.retryQuery && onRetry(msg.retryQuery)}
                    className="mt-1 font-semibold text-[#d4af37] hover:underline"
                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                  >
                    Retry →
                  </button>
                ) : null}
              </div>
            ) : null}
            <div
              className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#d4af37]/15 pt-2"
              style={{ pointerEvents: "auto" }}
            >
              <button
                type="button"
                onClick={() => void copyResponse()}
                className="rounded p-1 safety-bot-muted hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Copy response"
              >
                <Copy size={12} />
              </button>
              {copied ? (
                <span className="text-[10px] text-emerald-400">Copied!</span>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  saveBotFeedback({
                    question: userQuestion,
                    response: msg.summary,
                    rating: "good",
                    timestamp: new Date().toISOString(),
                  })
                }
                className="rounded p-1 safety-bot-muted hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Good response"
              >
                <ThumbsUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => setShowFeedbackMenu((v) => !v)}
                className="rounded p-1 safety-bot-muted hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Bad response"
              >
                <ThumbsDown size={12} />
              </button>
              <button
                type="button"
                onClick={goDashboard}
                className="text-[10px] font-semibold text-[#d4af37] hover:underline"
                style={{ pointerEvents: "auto", cursor: "pointer" }}
              >
                View in dashboard →
              </button>
            </div>
            {showFeedbackMenu ? (
              <div className="mt-1 flex flex-wrap gap-1" style={{ pointerEvents: "auto" }}>
                {["Wrong numbers", "Not relevant", "Too vague", "Other"].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      saveBotFeedback({
                        question: userQuestion,
                        response: msg.summary,
                        rating: "bad",
                        timestamp: new Date().toISOString(),
                        reason,
                      });
                      setShowFeedbackMenu(false);
                    }}
                    className="rounded border border-[#d4af37]/30 px-2 py-0.5 text-[9px] safety-bot-muted"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
