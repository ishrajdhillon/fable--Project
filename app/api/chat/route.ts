import { NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

function getCurrentDate(timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      timeZone,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date());
  }
}

function shouldUseWebSearch(message: string) {
  const text = message.toLowerCase();

  const signals = [
    "today",
    "tonight",
    "tomorrow",
    "yesterday",
    "latest",
    "recent",
    "currently",
    "current ",
    "right now",
    "this week",
    "this month",
    "this year",
    "news",
    "breaking",
    "update",
    "updated",
    "price",
    "stock",
    "market",
    "exchange rate",
    "weather",
    "forecast",
    "score",
    "standings",
    "schedule",
    "election",
    "president",
    "prime minister",
    "ceo",
    "immigration",
    "express entry",
    "pr draw",
    "visa",
    "work permit",
    "law",
    "policy",
    "release date",
    "job opening",
    "hiring",
    "search the internet",
    "search online",
    "look up",
    "find online",
  ];

  return signals.some((signal) => text.includes(signal)) || /\b202[5-9]\b/.test(text);
}

function buildSystemPrompt(timeZone: string, webSearchEnabled: boolean) {
  const currentDate = getCurrentDate(timeZone);

  return `
You are Fable, a capable, thoughtful, and friendly AI assistant.

The user's local date is ${currentDate}.
The user's time zone is ${timeZone}.
Do not claim the current year is 2024.

${
  webSearchEnabled
    ? "Google Search grounding is enabled for this request. Use it for current or changing information and prefer fresh sources over model memory."
    : "Google Search is not enabled for this request. Answer from your general knowledge, and do not pretend stale information is current."
}

Help users think, write, code, learn, plan, and solve problems.
Be clear and concise by default, but become detailed when asked.
Use Markdown when it improves readability.
For programming requests, give practical code and explain important decisions.
Never claim to have completed actions you cannot actually perform.
`;
}

function appendSources(text: string, response: any) {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;

  if (!Array.isArray(chunks)) return text;

  const sources = chunks
    .map((chunk: any) => chunk?.web)
    .filter((web: any) => web?.uri)
    .map((web: any) => ({
      title: web.title || "Source",
      url: web.uri,
    }));

  const uniqueSources = Array.from(
    new Map(
      sources.map((source: { title: string; url: string }) => [source.url, source])
    ).values()
  ).slice(0, 5) as { title: string; url: string }[];

  if (uniqueSources.length === 0) return text;

  const sourceList = uniqueSources
    .map((source, index) => `${index + 1}. [${source.title}](${source.url})`)
    .join("\n");

  return `${text}\n\n---\n**Sources**\n${sourceList}`;
}

function isQuotaError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.includes("429") || text.includes("RESOURCE_EXHAUSTED") || text.toLowerCase().includes("quota");
}

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Fable is temporarily unavailable because the AI key is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const messages = body.messages as IncomingMessage[];
    const timeZone =
      typeof body.timeZone === "string" && body.timeZone.length < 100
        ? body.timeZone
        : "UTC";

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "A message is required." }, { status: 400 });
    }

    const sanitized = messages
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
      )
      .slice(-20)
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content.slice(0, 12000) }],
      }));

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content ?? "";

    const useWebSearch = shouldUseWebSearch(latestUserMessage);
    const ai = getGeminiClient();
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    try {
      const response = await ai.models.generateContent({
        model,
        contents: sanitized,
        config: {
          systemInstruction: buildSystemPrompt(timeZone, useWebSearch),
          ...(useWebSearch
            ? {
                tools: [
                  {
                    googleSearch: {},
                  },
                ],
              }
            : {}),
        },
      });

      const rawText = response.text || "I couldn't generate a response.";
      const message = useWebSearch ? appendSources(rawText, response) : rawText;

      return NextResponse.json({
        message,
        currentDate: getCurrentDate(timeZone),
        searchedWeb: useWebSearch,
      });
    } catch (error) {
      if (isQuotaError(error)) {
        return NextResponse.json(
          {
            error:
              "Fable has temporarily reached its free AI usage limit. Please try again later. The limit resets automatically based on Google's quota window.",
          },
          { status: 429 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Fable Gemini API error:", error);

    return NextResponse.json(
      {
        error: "Fable couldn't complete that request right now. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
