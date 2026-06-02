export type GroqMessage = { role: "user" | "assistant"; content: string };

export type AskGroqParams = {
  system: string;
  messages: GroqMessage[];
  jsonMode?: boolean;
  endpoint?: "/api/safety-bot/ask" | "/api/analyze";
};

export type AskGroqResult = {
  text: string;
  parsed?: Record<string, unknown> | null;
};

export class AskGroqError extends Error {
  status: number;
  userMessage: string;
  code?: string;

  constructor(status: number, userMessage: string, detail?: string, code?: string) {
    super(detail ?? userMessage);
    this.status = status;
    this.userMessage = userMessage;
    this.code = code;
  }
}

const TIMEOUT_MS = 60_000;

export async function askGroq(params: AskGroqParams): Promise<AskGroqResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const endpoint = params.endpoint ?? (params.jsonMode ? "/api/analyze" : "/api/safety-bot/ask");
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    const json = (await res.json()) as {
      text?: string;
      parsed?: Record<string, unknown>;
      error?: string;
      code?: string;
    };

    if (res.status === 503 && json.code === "NO_KEY") {
      throw new AskGroqError(
        503,
        "Groq API key not configured. Add GROQ_API_KEY to .env.local at the project root, then restart the dev server.",
        json.error,
        json.code,
      );
    }

    if (res.status === 429) {
      throw new AskGroqError(
        429,
        "Rate limit reached. Please wait 60 seconds and try again.",
        json.error,
        json.code,
      );
    }

    if (res.status >= 500) {
      throw new AskGroqError(
        500,
        "AI service temporarily unavailable — your data is still loaded and visible in the dashboard.",
        json.error,
        json.code,
      );
    }

    if (res.status === 422) {
      throw new AskGroqError(
        422,
        json.error ?? "AI returned invalid JSON. Please run analysis again.",
        json.error,
        json.code,
      );
    }

    if (!res.ok) {
      throw new AskGroqError(
        res.status,
        json.error ?? "Could not get an AI response. Please try again.",
        undefined,
        json.code,
      );
    }

    if (!json.text && !json.parsed) {
      throw new AskGroqError(500, "Empty response from AI service.");
    }

    return {
      text: json.text ?? JSON.stringify(json.parsed),
      parsed: json.parsed ?? null,
    };
  } catch (err) {
    if (err instanceof AskGroqError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AskGroqError(408, "Response timed out — please try again.");
    }
    throw new AskGroqError(
      0,
      err instanceof Error ? err.message : "Network error — please try again.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Trim conversation to ~8000 characters for API context. */
export function trimConversationMessages(
  messages: GroqMessage[],
  maxChars = 8000,
): GroqMessage[] {
  let total = messages.reduce((sum, m) => sum + m.content.length, 0);
  const trimmed = [...messages];
  while (total > maxChars && trimmed.length > 2) {
    const removed = trimmed.shift();
    if (removed) total -= removed.content.length;
  }
  return trimmed;
}
