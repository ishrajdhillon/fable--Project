import { NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

function getCurrentDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date());
}

function shouldUseWebSearch(message: string) {
  const text = message.toLowerCase();

  const freshnessSignals = [
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
    "new model",
    "version",
    "job opening",
    "hiring",
    "available now",
    "open now",
  ];

  if (freshnessSignals.some((signal) => text.includes(signal))) {
    return true;
  }

  // Explicit years close to the present are also a strong signal that fresh data may matter.
  return /\b202[5-9]\b/.test(text);
}

function buildSystemPrompt(webSearchEnabled: boolean) {
  const currentDate = getCurrentDate();

  return `
You are Fable, a capable, thoughtful, and friendly AI assistant.

The current date is ${currentDate}.
Do not claim that the current year is 2024 or rely on an old training cutoff when answering time-sensitive questions.

Help users think, write, code, learn, plan, and solve problems.
Be clear and concise by default, but become detailed when asked.
Use Markdown when it improves readability.
For programming requests, give practical code and explain important decisions.
Never claim to have completed actions you cannot actually perform.

${
  webSearchEnabled
    ? "Google Search grounding is enabled for this request. Use it whenever the answer depends on current, recent, changing, or real-world information. Prefer fresh sources over model memory. If sources disagree, say so."
    : "Google Search grounding is not enabled for this request. If the user asks for information that may have changed recently, do not pretend your internal knowledge is current."
}
`;
}

function appendSources(text: string, response: any) {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;

  if (!Array.isArray(chunks)) {
    return text;
  }

  const sources = chunks
    .map((chunk: any) => chunk?.web)
    .filter((web: any) => web?.uri)
    .map((web: any) => ({
      title: web.title || "Source",
      url: web.uri,
    }));

  const uniqueSources = Array.from(
    new Map(sources.map((source: { title: string; url: string }) => [source.url, source])).values()
  ).slice(0, 5) as { title: string; url: string }[];

  if (uniqueSources.length === 0) {
    return text;
  }

  const sourceList = uniqueSources
    .map((source, index) => `${index + 1}. [${source.title}](${source.url})`)
    .join("\n");

  return `${text}\n\n---\n**Sources**\n${sourceList}`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing. Add it to .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const messages = body.messages as IncomingMessage[];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "A message is required." },
        { status: 400 }
      );
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

    // Gemini 2.5 Flash currently supports Google Search grounding on the free tier
    // (subject to Google's daily quota), while keeping the normal model for everyday chat.
    const model = useWebSearch
      ? process.env.GEMINI_SEARCH_MODEL || "gemini-2.5-flash"
      : process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    const response = await ai.models.generateContent({
      model,
      contents: sanitized,
      config: {
        systemInstruction: buildSystemPrompt(useWebSearch),
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
      searchedWeb: useWebSearch,
      currentDate: getCurrentDate(),
    });
  } catch (error) {
    console.error("Fable Gemini API error:", error);

    const detail =
      error instanceof Error ? error.message : "Unknown Gemini API error.";

    return NextResponse.json(
      {
        error: `Fable could not reach Gemini. ${detail}`,
      },
      { status: 500 }
    );
  }
}
