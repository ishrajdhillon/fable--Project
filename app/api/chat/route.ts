import { NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";

type IncomingMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `
You are Fable, a capable, thoughtful, and friendly AI assistant.

Help users think, write, code, learn, plan, and solve problems.
Be clear and concise by default, but become detailed when asked.
Use Markdown when it improves readability.
For programming requests, give practical code and explain important decisions.
Never claim to have completed actions you cannot actually perform.
`;

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

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.7-flash",
      contents: sanitized,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });

    return NextResponse.json({
      message: response.text || "I couldn't generate a response.",
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
