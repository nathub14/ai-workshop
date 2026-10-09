"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PublicBot } from "@/lib/exerciseBots";

type Msg = { role: "user" | "assistant"; text: string; error?: boolean };

const CODE_KEY = "lab_code_v1"; // same access code as the main Lab

// A fresh chat each time a bot is opened, kept apart from the main chat and the other bots.
export default function ExerciseChat({ bot }: { bot: PublicBot }) {
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRun = useRef(0); // bumps on "New chat" so a late reply can't land in the new chat
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let saved = "";
    try {
      saved = JSON.parse(localStorage.getItem(CODE_KEY) || '""');
    } catch {}
    if (saved) {
      setCode(saved);
      fetch("/api/check", { method: "POST", body: JSON.stringify({ code: saved }) })
        .then((r) => r.json())
        .then((d) => setUnlocked(!!d.ok))
        .catch(() => {})
        .finally(() => setReady(true));
    } else setReady(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setCodeError("");
    const d = await fetch("/api/check", { method: "POST", body: JSON.stringify({ code }) }).then((r) => r.json());
    if (d.ok) {
      try {
        localStorage.setItem(CODE_KEY, JSON.stringify(code));
      } catch {}
      setUnlocked(true);
    } else setCodeError("That code isn't right.");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const run = chatRun.current;
    const history: Msg[] = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    setLoading(true);
    let reply: Msg;
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, bot: bot.id, messages: history.filter((m) => !m.error).map(({ role, text }) => ({ role, text })) }),
      });
      const d = await r.json();
      reply = d.error ? { role: "assistant", text: d.error, error: true } : { role: "assistant", text: d.text };
    } catch {
      reply = { role: "assistant", text: "Couldn't reach the AI. Check the wifi and try again.", error: true };
    }
    if (run !== chatRun.current) return;
    setMessages((m) => [...m, reply]);
    setLoading(false);
  }

  function newChat() {
    chatRun.current++;
    setMessages([]);
    setInput("");
    setLoading(false);
  }

  if (!ready) return null;

  if (!unlocked) {
    return (
      <main className="gate">
        <form onSubmit={unlock} className="gate-card">
          <div className="mark" />
          <h1>AI Launch Lab</h1>
          <p>Enter the access code to start.</p>
          <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" />
          <button type="submit" className="btn primary block">Enter</button>
          {codeError && <p className="err">{codeError}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="ex-chat">
      <section className="chat">
        <header className="chat-head">
          <Link href="/exercises" className="btn small">← Exercises</Link>
          <h2>{bot.name}</h2>
          <button className="btn small" onClick={newChat} disabled={!messages.length && !input}>New chat</button>
        </header>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty">
              <h3>{bot.name}</h3>
              <p>{bot.description}</p>
              <span className="ex-badge">Training bot – exaggerates a real AI weakness on purpose</span>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
              <div className="bubble">
                {m.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  <p className="pre">{m.text}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg assistant">
              <div className="bubble thinking">
                Thinking…
                <span className="dots"><i /><i /><i /></span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <div className="chips">
            {bot.chips.map((c) => (
              <button key={c} className="chip" onClick={() => { setInput(c); inputRef.current?.focus(); }}>
                {c}
              </button>
            ))}
          </div>
          <div className="input-row">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${bot.name}…`}
              rows={2}
            />
            <button className="btn primary send" onClick={send} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
