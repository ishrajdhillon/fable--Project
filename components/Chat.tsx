"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Menu, Moon, Plus, RotateCcw, Sparkles, Sun } from "lucide-react";
import Message from "./Message";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const suggestions = [
  {
    title: "Write",
    text: "Help me turn a rough idea into clear, polished writing.",
    prompt: "Help me turn a rough idea into clear, polished writing.",
  },
  {
    title: "Code",
    text: "Build or debug something with me step by step.",
    prompt: "I want to build something. Help me plan and code it step by step.",
  },
  {
    title: "Learn",
    text: "Explain a difficult topic in a simple, memorable way.",
    prompt: "Teach me a difficult topic in a simple and memorable way.",
  },
];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const saved = localStorage.getItem("fable-theme") as
      | "light"
      | "dark"
      | null;

    const preferred =
      saved ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");

    setTheme(preferred);
    document.documentElement.dataset.theme = preferred;
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";

    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("fable-theme", next);
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setError("");
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          timeZone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Fable could not answer that. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="fable-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <span>Fable</span>
        </div>

        <button className="new-chat" onClick={newChat}>
          <span>New chat</span>
          <Plus size={17} />
        </button>

        <div>
          <div className="sidebar-label">Chats</div>
          <div className="empty-history">
            <div className="construction-status">
              <span className="status-dot"></span>
              Under construction
            </div>

            <p>Chat history and accounts are coming soon.</p>
          </div>
        </div>

        <div className="sidebar-footer">fabel.space · AI workspace</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="top-actions">
            <button className="icon-button mobile-menu" aria-label="Menu">
              <Menu size={18} />
            </button>
            <div className="topbar-title">Fable AI</div>
          </div>

          <div className="top-actions">
            <button
              className="icon-button"
              onClick={newChat}
              title="Reset conversation"
              aria-label="Reset conversation"
            >
              <RotateCcw size={16} />
            </button>
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <section className="chat-area">
          {error && <div className="error-banner">{error}</div>}

          {messages.length === 0 ? (
            <div className="welcome">
              <div className="creator">
                Designed & built by <span>Ishraj Dhillon</span>
              </div>
              <div className="welcome-kicker">
                <Sparkles size={14} style={{ display: "inline", marginRight: 7 }} />
                Your AI workspace
              </div>
              <h1>What will you<br />make of it?</h1>
              <p>
                Think through ideas, write better, solve problems, learn faster,
                and build with Fable.
              </p>

              <div className="suggestions">
                {suggestions.map((item) => (
                  <button
                    className="suggestion"
                    key={item.title}
                    onClick={() => void sendMessage(item.prompt)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((message) => (
                <Message key={message.id} message={message} />
              ))}

              {loading && (
                <div className="message assistant">
                  <div className="ai-avatar">F</div>
                  <div className="message-bubble">
                    <span className="typing" aria-label="Fable is thinking">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <div className="composer-wrap">
          <form className="composer" onSubmit={onSubmit}>
            <textarea
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask Fable anything…"
              aria-label="Message Fable"
            />
            <div className="composer-bottom">
              <span className="model-label">Fable · powered by Gemini</span>
              <button
                type="submit"
                className="send-button"
                disabled={!input.trim() || loading}
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
