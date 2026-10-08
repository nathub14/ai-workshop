"use client";

import { useState } from "react";

type Cfg = { chatPrompt: string; builderPrompt: string; demoPrompt: string };

const FIELDS: { key: keyof Cfg; label: string; help: string }[] = [
  { key: "chatPrompt", label: "Front prompt (every message)", help: "Hidden instructions put in front of everything the kids send." },
  { key: "builderPrompt", label: "Builder prompt", help: "Added when 🛠 Builder is on. Must tell the AI to reply with one HTML file." },
  { key: "demoPrompt", label: "Professor Know-It-All prompt", help: "Used only when the app is opened with ?demo=1 at the end of the link." },
];

export default function Admin() {
  const [pw, setPw] = useState("");
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [defaults, setDefaults] = useState<Cfg | null>(null);
  const [status, setStatus] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin", { headers: { "x-admin-password": pw } });
    const d = await r.json();
    if (d.config) {
      setCfg(d.config);
      setDefaults(d.defaults);
      setStatus("");
    } else setStatus(d.error || "Couldn't load");
  }

  async function save() {
    if (!cfg) return;
    setStatus("Saving…");
    const r = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-password": pw },
      body: JSON.stringify(cfg),
    });
    const d = await r.json();
    setStatus(d.ok ? "Saved. New messages use it straight away (allow up to a minute)." : d.error || "Save failed");
  }

  if (!cfg) {
    return (
      <main className="gate">
        <form onSubmit={login} className="gate-card">
          <h1>Lab admin</h1>
          <input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Admin password" />
          <button type="submit">Open</button>
          {status && <p className="err">{status}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <h1>Lab admin</h1>
      {FIELDS.map((f) => (
        <div key={f.key} className="field">
          <div className="field-head">
            <label>{f.label}</label>
            <button className="ghost" onClick={() => defaults && setCfg({ ...cfg, [f.key]: defaults[f.key] })}>Reset to default</button>
          </div>
          <p className="help">{f.help}</p>
          <textarea value={cfg[f.key]} onChange={(e) => setCfg({ ...cfg, [f.key]: e.target.value })} rows={10} />
        </div>
      ))}
      <div className="row">
        <button className="btn primary" onClick={save}>Save</button>
        <span>{status}</span>
      </div>
    </main>
  );
}
