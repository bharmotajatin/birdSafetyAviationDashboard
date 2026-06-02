import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { runGroqCompletion } from "@/lib/safety-bot/runGroqCompletion";

type Body = {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  jsonMode?: boolean;
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

  try {
    const text = await Promise.race([
      runGroqCompletion({
        apiKey,
        system: body.system,
        messages: body.messages,
        jsonMode: body.jsonMode,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout")), 60_000);
      }),
    ]);

    if (!text) {
      return NextResponse.json({ error: "Empty response from Groq" }, { status: 500 });
    }

    return NextResponse.json({ text });
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
  }
}
