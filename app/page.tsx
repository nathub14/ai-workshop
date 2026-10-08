"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import QRCode from "qrcode";

type Source = { title: string; url: string };
type Msg = {
  role: "user" | "assistant";
  text: string;
  html?: string | null;
  images?: string[];
  sources?: Source[];
  error?: boolean;
  xray?: unknown;
};
type Chat = { id: string; title: string; messages: Msg[]; createdAt: number };

const CHATS_KEY = "lab_chats_v1";
const CODE_KEY = "lab_code_v1";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}
function newChat(): Chat {
  return { id: Math.random().toString(36).slice(2, 10), title: "New chat", messages: [], createdAt: Date.now() };
}

export default function Lab() {
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(false);
  const [images, setImages] = useState(false);
  const [builder, setBuilder] = useState(false);
  const [demo, setDemo] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [share, setShare] = useState<{ url: string; qr: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [openXray, setOpenXray] = useState<number | null>(null);
  const [sidebar, setSidebar] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load saved state
  useEffect(() => {
    const saved = load<Chat[]>(CHATS_KEY, []);
    const list = saved.length ? saved : [newChat()];
    setChats(list);
    setCurrentId(list[0].id);
    const savedCode = load<string>(CODE_KEY, "");
    if (savedCode) {
      setCode(savedCode);
      fetch("/api/check", { method: "POST", body: JSON.stringify({ code: savedCode }) })
        .then((r) => r.json())
        .then((d) => setUnlocked(!!d.ok))
        .catch(() => {});
    }
    if (new URLSearchParams(location.search).get("demo") === "1") setDemo(true);
    setReady(true);
  }, []);

  // Save chats (without the bulky x-ray data)
  useEffect(() => {
    if (!ready) return;
    store(
      CHATS_KEY,
      chats.map((c) => ({ ...c, messages: c.messages.map(({ xray, ...m }) => m) }))
    );
  }, [chats, ready]);

  const chat = chats.find((c) => c.id === currentId);
  const messages = chat?.messages ?? [];

  const htmlVersions = useMemo(
    () => messages.map((m, i) => ({ m, i })).filter((x) => x.m.html),
    [messages]
  );
  const shownIdx = previewIdx ?? (htmlVersions.length ? htmlVersions[htmlVersions.length - 1].i : null);
  const shownHtml = shownIdx != null ? messages[shownIdx]?.html ?? null : null;
  const versionNumber = htmlVersions.findIndex((x) => x.i === shownIdx) + 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  useEffect(() => {
    setPreviewIdx(null);
    setOpenXray(null);
  }, [currentId]);

  function updateChat(id: string, fn: (c: Chat) => Chat) {
    setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setCodeError("");
    const r = await fetch("/api/check", { method: "POST", body: JSON.stringify({ code }) });
    const d = await r.json();
    if (d.ok) {
      store(CODE_KEY, code);
      setUnlocked(true);
    } else setCodeError("That code isn't right. Check the whiteboard!");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !chat) return;
    const chatId = chat.id;
    const userMsg: Msg = { role: "user", text };
    const history = [...chat.messages, userMsg];
    updateChat(chatId, (c) => ({
      ...c,
      title: c.messages.length ? c.title : text.slice(0, 40),
      messages: history,
    }));
    setInput("");
    setLoading(true);
    setPreviewIdx(null);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          search,
          images,
          builder,
          demo,
          messages: history.map((m) => ({ role: m.role, text: m.text, html: m.html, images: m.images })),
        }),
      });
      const d = await r.json();
      const reply: Msg = d.error
        ? { role: "assistant", text: d.error, error: true, xray: d.xray }
        : { role: "assistant", text: d.text, html: d.html, images: d.images, sources: d.sources, xray: d.xray };
      updateChat(chatId, (c) => ({ ...c, messages: [...c.messages, reply] }));
    } catch {
      updateChat(chatId, (c) => ({
        ...c,
        messages: [...c.messages, { role: "assistant", text: "Couldn't reach the AI. Check the wifi and try again.", error: true }],
      }));
    } finally {
      setLoading(false);
    }
  }

  async function doShare() {
    if (!shownHtml) return;
    setSharing(true);
    try {
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, html: shownHtml }),
      });
      const d = await r.json();
      if (d.url) setShare({ url: d.url, qr: await QRCode.toDataURL(d.url, { width: 360, margin: 1 }) });
    } finally {
      setSharing(false);
    }
  }

  function addChat() {
    const c = newChat();
    setChats((cs) => [c, ...cs]);
    setCurrentId(c.id);
  }

  function deleteChat(id: string) {
    if (!confirm("Delete this chat?")) return;
    setChats((cs) => {
      const rest = cs.filter((c) => c.id !== id);
      const list = rest.length ? rest : [newChat()];
      if (id === currentId) setCurrentId(list[0].id);
      return list;
    });
  }

  if (!ready) return null;

  if (!unlocked) {
    return (
      <main className="gate">
        <form onSubmit={unlock} className="gate-card">
          <div className="logo-dot" />
          <h1>AI Launch Lab</h1>
          <p>Type the code from the whiteboard</p>
          <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" />
          <button type="submit">Let's go</button>
          {codeError && <p className="err">{codeError}</p>}
        </form>
      </main>
    );
  }

  const showPreview = !!shownHtml;

  return (
    <main className={`app ${showPreview ? "with-preview" : ""} ${fullscreen ? "fs" : ""} ${sidebar ? "" : "no-side"}`}>
      {sidebar && (
        <aside className="side">
          <div className="brand">
            <div className="logo-dot small" /> AI Launch Lab
          </div>
          <button className="new" onClick={addChat}>+ New chat</button>
          <div className="chat-list">
            {chats.map((c) => (
              <div key={c.id} className={`chat-item ${c.id === currentId ? "on" : ""}`} onClick={() => setCurrentId(c.id)}>
                <span>{c.title}</span>
                <button className="x" title="Delete" onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}>×</button>
              </div>
            ))}
          </div>
          {demo && <div className="demo-badge">Professor Know-It-All mode</div>}
        </aside>
      )}

      <section className="chat">
        <header className="chat-head">
          <button className="ghost" onClick={() => setSidebar((s) => !s)}>{sidebar ? "◀" : "☰"}</button>
          <h2>{chat?.title}</h2>
        </header>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty">
              <h3>What do you want to make?</h3>
              <p>Remember: <b>WHO</b> am I? <b>WHAT</b> do I want? <b>HOW</b> do I want it? An <b>EXAMPLE</b>.</p>
              <p className="tips">Turn on 🔎 to search the web, 🎨 to make pictures, 🛠 to build a website, survey or slides.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
              <div className="bubble">
                {m.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}
                  >
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  <p className="pre">{m.text}</p>
                )}
                {m.images?.map((src) => (
                  <div key={src} className="img-wrap">
                    <img src={src} alt="AI-made picture" />
                    <a className="btn small" href={src} download>Download</a>
                  </div>
                ))}
                {m.html && (
                  <button className={`btn small ${shownIdx === i ? "on" : ""}`} onClick={() => setPreviewIdx(i)}>
                    🛠 Show version {htmlVersions.findIndex((x) => x.i === i) + 1}
                  </button>
                )}
                {!!m.sources?.length && (
                  <div className="sources">
                    <b>Sources — click one and check it!</b>
                    {m.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                    ))}
                  </div>
                )}
                {!!m.xray && (
                  <>
                    <button className="xray-btn" onClick={() => setOpenXray(openXray === i ? null : i)}>
                      🔍 X-ray: what was really sent
                    </button>
                    {openXray === i && <pre className="xray">{JSON.stringify(m.xray, null, 2)}</pre>}
                  </>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg assistant">
              <div className="bubble thinking">
                {builder ? "Building your page… (this can take up to a minute)" : images ? "Making it… pictures take a little while" : search ? "Searching the web…" : "Thinking…"}
                <span className="dots"><i /><i /><i /></span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <div className="toggles">
            <button className={`tog ${search ? "on" : ""}`} disabled={builder || demo} onClick={() => setSearch((v) => !v)}>🔎 Web search</button>
            <button className={`tog ${images ? "on" : ""}`} disabled={builder || demo} onClick={() => setImages((v) => !v)}>🎨 Make pictures</button>
            <button className={`tog ${builder ? "on" : ""}`} disabled={demo} onClick={() => setBuilder((v) => !v)}>🛠 Builder</button>
          </div>
          <div className="input-row">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={builder ? "Describe the page you want, or what to change…" : "Type your prompt… (Enter to send, Shift+Enter for a new line)"}
              rows={3}
            />
            <button className="send" onClick={send} disabled={loading || !input.trim()}>Send</button>
          </div>
        </div>
      </section>

      {showPreview && (
        <section className="preview">
          <div className="preview-bar">
            <div className="ver">
              <button className="ghost" disabled={versionNumber <= 1} onClick={() => setPreviewIdx(htmlVersions[versionNumber - 2].i)}>◀</button>
              <span>Version {versionNumber} of {htmlVersions.length}</span>
              <button className="ghost" disabled={versionNumber >= htmlVersions.length} onClick={() => setPreviewIdx(htmlVersions[versionNumber].i)}>▶</button>
            </div>
            <div className="actions">
              <button className="btn small" onClick={() => setFullscreen((f) => !f)}>{fullscreen ? "Exit full screen" : "Full screen"}</button>
              <button className="btn small primary" onClick={doShare} disabled={sharing}>{sharing ? "Saving…" : "Share (link + QR)"}</button>
            </div>
          </div>
          <iframe
            key={shownIdx ?? -1}
            title="Your page"
            srcDoc={shownHtml!}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
          />
        </section>
      )}

      {share && (
        <div className="modal" onClick={() => setShare(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Your page is live!</h3>
            <img src={share.qr} alt="QR code for your page" />
            <a href={share.url} target="_blank" rel="noreferrer">{share.url}</a>
            <div className="row">
              <button className="btn small" onClick={() => navigator.clipboard?.writeText(share.url)}>Copy link</button>
              <button className="btn small primary" onClick={() => setShare(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
