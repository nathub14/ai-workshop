"use client";

import { useState } from "react";

type Cfg = { chatPrompt: string; builderPrompt: string; demoPrompt: string; showXray: boolean };
type PromptKey = "chatPrompt" | "builderPrompt" | "demoPrompt";
type Status = {
  storage: { ok: boolean; message: string };
  models: { chat: string; builder: string; key: boolean };
};

const FIELDS: { key: PromptKey; label: string; help: string; rows: number }[] = [
  { key: "chatPrompt", label: "Front prompt", help: "Hidden instructions put in front of everything the students send.", rows: 8 },
  { key: "builderPrompt", label: "Build prompt", help: "Added in Build mode. Must tell the AI to reply with one HTML file in a code block. Technical rules (saving survey answers, safety) are added automatically after this.", rows: 22 },
  { key: "demoPrompt", label: "Professor Know-It-All", help: "Used only when the app is opened with ?demo=1 at the end of the link.", rows: 5 },
];

export default function Admin() {
  const [pw, setPw] = useState("");
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [defaults, setDefaults] = useState<Cfg | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [msg, setMsg] = useState("");

  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    const r = await fetch("/api/admin", { headers: { "x-admin-password": pw } });
    const d = await r.json();
    if (d.config) {
      setCfg(d.config);
      setDefaults(d.defaults);
      setStatus({ storage: d.storage, models: d.models });
      setMsg("");
    } else setMsg(d.error || "Couldn't load");
  }

  async function save() {
    if (!cfg) return;
    setMsg("Saving…");
    const r = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-password": pw },
      body: JSON.stringify(cfg),
    });
    const d = await r.json();
    setMsg(d.ok ? "Saved. Applies to new messages within a minute." : d.error || "Save failed");
  }

  if (!cfg) {
    return (
      <main className="gate">
        <form onSubmit={login} className="gate-card">
          <h1>Lab admin</h1>
          <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Admin password" />
          <button type="submit" className="btn primary block">Open</button>
          {msg && <p className="err">{msg}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <h1>Lab admin</h1>
      {status && (
        <div className="status">
          <div>
            <b>Storage (pictures + share links)</b>
            <span className={status.storage.ok ? "good" : "bad"}>{status.storage.ok ? "Working" : "Not working"}</span>
            <span>{status.storage.message}</span>
          </div>
          <div>
            <b>OpenAI key</b>
            <span className={status.models.key ? "good" : "bad"}>{status.models.key ? "Set" : "Missing"}</span>
          </div>
          <div>
            <b>Models</b>
            <span>Chat: {status.models.chat}</span>
            <span>Build: {status.models.builder}</span>
          </div>
        </div>
      )}
      <button className="btn small" style={{ alignSelf: "flex-start" }} onClick={() => login()}>Re-check status</button>
      <label className="toggle-row">
        <input type="checkbox" checked={!!cfg.showXray} onChange={(e) => setCfg({ ...cfg, showXray: e.target.checked })} />
        <span>
          <b>Show X-ray</b>
          <span className="help">Adds an "X-ray: what was actually sent" link under each reply in the main chat, showing the hidden prompt and whole conversation. Never shown on the exercise bots. Press Save to apply.</span>
        </span>
      </label>
      {FIELDS.map((f) => (
        <div key={f.key} className="field">
          <div className="field-head">
            <label>{f.label}</label>
            <button className="btn small" onClick={() => defaults && setCfg({ ...cfg, [f.key]: defaults[f.key] })}>Reset to default</button>
          </div>
          <p className="help">{f.help}</p>
          <textarea value={cfg[f.key]} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })} rows={f.rows} />
        </div>
      ))}
      <div className="row">
        <button className="btn primary" onClick={save}>Save</button>
        <span>{msg}</span>
      </div>
    </main>
  );
}
