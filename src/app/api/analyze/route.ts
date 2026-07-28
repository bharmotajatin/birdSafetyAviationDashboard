import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { runGroqCompletion } from "@/lib/safety-bot/runGroqCompletion";
import { safeParseResult } from "@/lib/safety-report/safeParseResult";

type Body = {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

const PLACEHOLDER_KEYS = new Set(["your_groq_key_here"]);

function resolveGroqApiKey(): string {
  const envKey = process.env.GROQ_API_KEY?.trim() ?? "";
  if (envKey && !PLACEHOLDER_KEYS.has(envKey)) return envKey;
  return "";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiKey = resolveGroqApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing GROQ_API_KEY. Add it to .env.local at the project root (next to package.json), then restart the dev server.",
        code: "NO_KEY",
      },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const content = await runGroqCompletion({
      apiKey,
      system: body.system,
      messages: body.messages,
      jsonMode: true,
      signal: controller.signal,
    });

    if (!content) {
      return NextResponse.json({ error: "Empty response from Groq" }, { status: 500 });
    }

    const parsed = safeParseResult(content);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "AI returned invalid JSON. Please run analysis again.",
          text: content,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ parsed, text: content });
  } catch (err) {
    const sdkStatus =
      err instanceof Groq.APIError && typeof err.status === "number" ? err.status : undefined;

    if (sdkStatus === 429) {
      return NextResponse.json(
        { error: "Rate limit reached. Please wait 60 seconds and try again." },
        { status: 429 },
      );
    }

    if (sdkStatus && sdkStatus >= 500) {
      return NextResponse.json({ error: "Groq service error" }, { status: 500 });
    }

    if (err instanceof Error && (err.name === "AbortError" || err.message === "Timeout")) {
      return NextResponse.json({ error: "Timeout" }, { status: 408 });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
