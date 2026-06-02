import type { LucideIcon } from "lucide-react";
import type { IncidentLogBotFilters } from "@/lib/safety-bot/incident-log-nav";
import type { DashboardData, Incident } from "@/lib/types";

export type BotAnswerRow = {
  label: string;
  value: string;
  highlight?: boolean;
};

export type BotAnswer = {
  headline: string;
  rows: BotAnswerRow[];
  summary: string;
};

export type QuickQuestion = {
  id: string;
  icon: LucideIcon;
  label: string;
  fullQuery: string;
  answer: (data: DashboardData) => BotAnswer;
};

export type NaturalQueryResult = {
  matchedIncidents: Incident[];
  filterDescription: string;
  summary: string;
  navigateFilters: IncidentLogBotFilters;
};

export type ChatMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "bot";
      summary: string;
      rows: BotAnswerRow[];
      matchedCount: number;
      matchedIncidents?: Incident[];
      questionId?: string;
      filterDescription?: string;
      contextNote?: string;
      navigateFilters?: IncidentLogBotFilters;
      error?: string;
      retryQuery?: string;
    };

export type SessionExchange = {
  id: string;
  question: string;
  preview: string;
  timestamp: number;
  messageCount: number;
};
