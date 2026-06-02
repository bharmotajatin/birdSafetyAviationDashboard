const FEEDBACK_KEY = "bfs_bot_feedback";

export type BotFeedbackEntry = {
  question: string;
  response: string;
  rating: "good" | "bad";
  timestamp: string;
  reason?: string;
};

export function saveBotFeedback(entry: BotFeedbackEntry) {
  if (typeof window === "undefined") return;
  const existing = JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? "[]") as BotFeedbackEntry[];
  existing.push(entry);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(existing.slice(-100)));
}

export function messageToCopyText(summary: string, rows: { label: string; value: string }[]): string {
  const lines = [summary, "", ...rows.map((r) => `${r.label}: ${r.value}`)];
  return lines.join("\n");
}
