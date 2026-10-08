"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import QRCode from "qrcode";

type Mode = "chat" | "search" | "image" | "build";
type Source = { title: string; url: string };
type Msg = {
  role: "user" | "assistant";
  text: string;
  html?: string | null;
  images?: string[];
  sources?: Source[];
  error?: boolean;
  mode?: Mode;
  xray?: unknown;
};
type Chat = { id: string; title: string; messages: Msg[]; createdAt: number };

const CHATS_KEY = "lab_chats_v1";
const CODE_KEY = "lab_code_v1";

const MODES: { id: Mode; label: string; hint: string; placeholder: string }[] = [
  { id: "chat", label: "Chat", hint: "Talk to the AI", placeholder: "Ask anything. Use WHO / WHAT / HOW / EXAMPLE for better answers." },
  { id: "search", label: "Web search", hint: "Answers with sources you can check", placeholder: "What should it look up? e.g. Find 2 stats showing dogs hurt their paws on hot footpaths, with links." },
  { id: "image", label: "Image", hint: "Make or edit pictures", placeholder: "Describe the picture: subject, style, background, lighting, angle…" },
  { id: "build", label: "Build", hint: "Websites, surveys, slide decks", placeholder: "Describe what to build (website, survey or slides) and give it your facts, prices and pictures…" },
];

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

async function shrinkImage(file: File): Promise<Blob> {
  const okType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (okType && file.size < 2_500_000) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("convert failed"))), "image/jpeg", 0.88));
}

export default function Lab() {
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [demo, setDemo] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [share, setShare] = useState<{ url: string; qr: string } | null>(null);
  const [shareError, setShareError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const [openXray, setOpenXray] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 800, h: 600 });

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

  useEffect(() => {
    if (!ready) return;
    store(CHATS_KEY, chats.map((c) => ({ ...c, messages: c.messages.map(({ xray, ...m }) => m) })));
  }, [chats, ready]);

  const chat = chats.find((c) => c.id === currentId);
  const messages = chat?.messages ?? [];
  const htmlVersions = useMemo(() => messages.map((m, i) => ({ m, i })).filter((x) => x.m.html), [messages]);
  const shownIdx = previewIdx ?? (htmlVersions.length ? htmlVersions[htmlVersions.length - 1].i : null);
  const shownHtml = shownIdx != null ? messages[shownIdx]?.html ?? null : null;
  const versionNumber = htmlVersions.findIndex((x) => x.i === shownIdx) + 1;
  const showPreview = !!shownHtml && previewOpen;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  useEffect(() => {
    setPreviewIdx(null);
    setOpenXray(null);
    setPreviewOpen(true);
  }, [currentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Measure the preview area so the desktop view can be scaled to fit.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPreview, fullscreen]);

  function flash(t: string) {
    setNotice(t);
    setTimeout(() => setNotice(""), 4000);
  }

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
    } else setCodeError("That code isn't right.");
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(true);
    try {
      for (const f of list.slice(0, 4)) {
        const blob = await shrinkImage(f);
        const fd = new FormData();
        fd.append("code", code);
        fd.append("file", blob, f.name);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await r.json();
        if (d.url) setPending((p) => [...p, d.url]);
        else flash(d.error || "Upload failed");
      }
    } catch {
      flash("Upload failed. Try a different picture.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !pending.length) || loading || uploading || !chat) return;
    const chatId = chat.id;
    const userMsg: Msg = { role: "user", text, images: pending.length ? pending : undefined, mode };
    const history = [...chat.messages, userMsg];
    updateChat(chatId, (c) => ({ ...c, title: c.messages.length ? c.title : (text || "Picture").slice(0, 48), messages: history }));
    setInput("");
    setPending([]);
    setLoading(true);
    setPreviewIdx(null);
    if (mode === "build") setPreviewOpen(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          mode,
          demo,
          messages: history.map((m) => ({ role: m.role, text: m.text, html: m.html, images: m.images })),
        }),
      });
      const d = await r.json();
      const reply: Msg = d.error
        ? { role: "assistant", text: d.error, error: true, xray: d.xray, mode }
        : { role: "assistant", text: d.text, html: d.html, images: d.images, sources: d.sources, xray: d.xray, mode };
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
    setShareError("");
    try {
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, html: shownHtml }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.url) setShare({ url: d.url, qr: await QRCode.toDataURL(d.url, { width: 360, margin: 1 }) });
      else setShareError(d.error || `Share failed (${r.status})`);
    } catch {
      setShareError("Share failed. Check the wifi and try again.");
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

  const currentMode = MODES.find((m) => m.id === mode)!;
  const scale = device === "desktop" ? Math.min(1, stage.w / 1280) : 1;

  return (
    <main className={`app ${sidebar ? "" : "no-side"} ${showPreview ? "with-preview" : ""} ${fullscreen && showPreview ? "fs" : ""}`}>
      {sidebar && (
        <aside className="side">
          <div className="side-head">
            <div className="brand"><div className="mark small" />Launch Lab</div>
            <button className="icon-btn dark" title="Hide sidebar" onClick={() => setSidebar(false)}>«</button>
          </div>
          <button className="btn primary block" onClick={addChat}>New chat</button>
          <div className="chat-list">
            {chats.map((c) => (
              <div key={c.id} className={`chat-item ${c.id === currentId ? "on" : ""}`} onClick={() => setCurrentId(c.id)}>
                <span>{c.title}</span>
                <button className="x" title="Delete chat" onClick={(e) => { e.stopPropagation(); deleteChat(c.id); }}>×</button>
              </div>
            ))}
          </div>
          {demo && <div className="demo-badge">Demo mode: Professor Know-It-All</div>}
        </aside>
      )}

      <section className="chat">
        <header className="chat-head">
          {!sidebar && <button className="icon-btn" title="Show sidebar" onClick={() => setSidebar(true)}>☰</button>}
          <h2>{chat?.title}</h2>
          {!!htmlVersions.length && !previewOpen && (
            <button className="btn small" onClick={() => setPreviewOpen(true)}>Show preview</button>
          )}
        </header>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty">
              <h3>Start with a clear prompt</h3>
              <div className="framework">
                <div><b>WHO</b><span>are you?</span></div>
                <div><b>WHAT</b><span>do you want?</span></div>
                <div><b>HOW</b><span>should it look or sound?</span></div>
                <div><b>EXAMPLE</b><span>of what good looks like</span></div>
              </div>
              <p className="muted">Pick a tool below. Attach pictures you've saved with the + button, or paste them in.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role} ${m.error ? "error" : ""}`}>
              {m.role === "assistant" && m.mode && m.mode !== "chat" && (
                <div className="tag">{MODES.find((x) => x.id === m.mode)?.label}</div>
              )}
              <div className="bubble">
                {m.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  m.text && <p className="pre">{m.text}</p>
                )}
                {!!m.images?.length && (
                  <div className={`img-grid ${m.role}`}>
                    {m.images.map((src) => (
                      <figure key={src}>
                        <img src={src} alt="" />
                        {m.role === "assistant" && (
                          <a className="btn small" href={src} download>Download</a>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
                {m.html && (
                  <button
                    className={`btn small ${shownIdx === i && previewOpen ? "active" : ""}`}
                    onClick={() => { setPreviewIdx(i); setPreviewOpen(true); }}
                  >
                    View version {htmlVersions.findIndex((x) => x.i === i) + 1}
                  </button>
                )}
                {!!m.sources?.length && (
                  <div className="sources">
                    <div className="label">Sources: open one and check it says that</div>
                    {m.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                    ))}
                  </div>
                )}
                {!!m.xray && (
                  <>
                    <button className="link-btn" onClick={() => setOpenXray(openXray === i ? null : i)}>
                      {openXray === i ? "Hide X-ray" : "X-ray: what was actually sent"}
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
                {mode === "build" ? "Building… a full page can take up to a minute" : mode === "image" ? "Generating the image… about 20 seconds" : mode === "search" ? "Searching the web…" : "Thinking…"}
                <span className="dots"><i /><i /><i /></span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="composer">
          <div className="modes" role="tablist">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                className={`mode ${mode === m.id ? "on" : ""}`}
                disabled={demo && m.id !== "chat"}
                onClick={() => setMode(m.id)}
                title={m.hint}
              >
                {m.label}
              </button>
            ))}
            <span className="mode-hint">{currentMode.hint}</span>
          </div>
          {(pending.length > 0 || uploading) && (
            <div className="pending">
              {pending.map((src) => (
                <div key={src} className="thumb">
                  <img src={src} alt="" />
                  <button title="Remove" onClick={() => setPending((p) => p.filter((x) => x !== src))}>×</button>
                </div>
              ))}
              {uploading && <div className="thumb loading">Uploading…</div>}
            </div>
          )}
          <div className="input-row">
            <button className="icon-btn attach" title="Attach a picture" onClick={() => fileRef.current?.click()}>+</button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  uploadFiles(files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={currentMode.placeholder}
              rows={3}
            />
            <button className="btn primary send" onClick={send} disabled={loading || uploading || (!input.trim() && !pending.length)}>
              Send
            </button>
          </div>
          {notice && <div className="notice">{notice}</div>}
        </div>
      </section>

      {showPreview && (
        <section className="preview">
          <div className="preview-bar">
            <div className="seg">
              <button className="icon-btn" disabled={versionNumber <= 1} onClick={() => setPreviewIdx(htmlVersions[versionNumber - 2].i)}>‹</button>
              <span className="ver">Version {versionNumber} / {htmlVersions.length}</span>
              <button className="icon-btn" disabled={versionNumber >= htmlVersions.length} onClick={() => setPreviewIdx(htmlVersions[versionNumber].i)}>›</button>
            </div>
            <div className="seg toggle">
              <button className={device === "desktop" ? "on" : ""} onClick={() => setDevice("desktop")}>Desktop</button>
              <button className={device === "mobile" ? "on" : ""} onClick={() => setDevice("mobile")}>Phone</button>
            </div>
            <div className="seg">
              <button className="btn small" onClick={() => setFullscreen((f) => !f)}>{fullscreen ? "Exit full screen" : "Full screen"}</button>
              <button className="btn small primary" onClick={doShare} disabled={sharing}>{sharing ? "Saving…" : "Share"}</button>
              {!fullscreen && <button className="icon-btn" title="Close preview" onClick={() => setPreviewOpen(false)}>×</button>}
            </div>
          </div>
          {shareError && <div className="share-error">{shareError}</div>}
          <div className={`stage ${device}`} ref={stageRef}>
            {device === "desktop" ? (
              <iframe
                key={shownIdx ?? -1}
                title="Preview"
                srcDoc={shownHtml!}
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                style={{ width: scale < 1 ? 1280 : "100%", height: scale < 1 ? stage.h / scale : "100%", transform: `scale(${scale})` }}
              />
            ) : (
              <iframe key={shownIdx ?? -1} title="Preview" srcDoc={shownHtml!} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="phone" />
            )}
          </div>
        </section>
      )}

      {share && (
        <div className="modal" onClick={() => setShare(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Your page is live</h3>
            <p className="muted">Scan to open it on a phone.</p>
            <img src={share.qr} alt="QR code for the page" />
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
