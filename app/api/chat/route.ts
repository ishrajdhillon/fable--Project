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

function buildSystemPrompt(timeZone: string) {
  const currentDate = getCurrentDate(timeZone);

  return `
You are Fable, a capable, thoughtful, and friendly AI assistant.

The user's local date is ${currentDate}.
The user's time zone is ${timeZone}.

You have access to Google Search grounding on this request.
Use Google Search whenever the answer could depend on current, recent, changing, or real-world information, including news, politics, immigration, laws, prices, sports, weather, companies, products, public figures, jobs, releases, schedules, or anything the user asks you to look up online.
You do NOT need to search for timeless questions, writing help, brainstorming, explanations, math, or coding questions that do not require fresh information.
Never say that you cannot browse or do not have internet access when Google Search grounding is available. If the user asks whether you can search the internet, explain that you can use Google Search for current information.
Prefer fresh sources over model memory for time-sensitive questions.
If sources disagree, say so clearly.
Do not claim the current year is 2024.

Help users think, write, code, learn, plan, and solve problems.
Be clear and concise by default, but become detailed when asked.
Use Markdown when it improves readability.
For programming requests, give practical code and explain important decisions.
Never claim to have completed actions you cannot actually perform.
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
    new Map(
      sources.map((source: { title: string; url: string }) => [source.url, source])
    ).values()
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
    const timeZone =
      typeof body.timeZone === "string" && body.timeZone.length < 100
        ? body.timeZone
        : "UTC";

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

    const ai = getGeminiClient();

    // Gemini 3.5 Flash-Lite supports Google Search grounding.
    // The model decides whether a search is actually useful for each request.
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

    const response = await ai.models.generateContent({
      model,
      contents: sanitized,
      config: {
        systemInstruction: buildSystemPrompt(timeZone),
        tools: [
          {
            googleSearch: {},
          },
        ],
      },
    });

    const rawText = response.text || "I couldn't generate a response.";
    const message = appendSources(rawText, response);

    return NextResponse.json({
      message,
      currentDate: getCurrentDate(timeZone),
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
