import Groq from "groq-sdk";

export type GroqChatMessage = { role: "user" | "assistant"; content: string };

export async function runGroqCompletion(params: {
  apiKey: string;
  system: string;
  messages: GroqChatMessage[];
  jsonMode?: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const groq = new Groq({ apiKey: params.apiKey });

  const completion = await groq.chat.completions.create(
    {
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: params.system },
        ...params.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      temperature: 0.3,
      max_tokens: params.jsonMode ? 4000 : 2048,
      ...(params.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    },
    { signal: params.signal },
  );

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
