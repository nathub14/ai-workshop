"use client";

import { useEffect, useState } from "react";

// Reusable prompts each student writes once (e.g. "About me") and drops into any chat.
// Saved in their own browser; shared by the main Lab and the exercise bots.
type Saved = { id: string; title: string; text: string };

const KEY = "lab_prompts_v1";
const STARTER: Saved = {
  id: "about-me",
  title: "About me",
  text: `About me: I'm [age] and in Year [4 or 5]. I love [hobbies and things I'm into].
How to talk to me: be [friendly / funny / straight to the point]. Use [simple / normal] words. Keep answers [short / medium]. Give examples about [something I like].`,
};

function load(): Saved[] {
  try {
    const v = localStorage.getItem(KEY);
    return v ? JSON.parse(v) : [STARTER];
  } catch {
    return [STARTER];
  }
}

export default function MyPrompts({ onUse }: { onUse: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Saved[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => setList(load()), []);

  function save(next: Saved[]) {
    setList(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked */
    }
  }

  function update(id: string, patch: Partial<Saved>) {
    save(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function add() {
    const p = { id: Math.random().toString(36).slice(2, 10), title: "New prompt", text: "" };
    save([...list, p]);
    setEditing(p.id);
  }

  function remove(id: string) {
    if (!confirm("Delete this prompt?")) return;
    save(list.filter((p) => p.id !== id));
  }

  return (
    <>
      <button className="btn small my-prompts-btn" onClick={() => setOpen(true)}>My prompts</button>
      {open && (
        <div className="modal" onClick={() => { setOpen(false); setEditing(null); }}>
          <div className="prompts-card" onClick={(e) => e.stopPropagation()}>
            <div className="prompts-head">
              <h3>My prompts</h3>
              <button className="icon-btn" title="Close" onClick={() => { setOpen(false); setEditing(null); }}>×</button>
            </div>
            <p className="muted">Write a prompt once, then add it to any chat with one click. Fill in the [blanks]. Never put your full name, school, address or passwords here.</p>
            <div className="prompts-list">
              {!list.length && <p className="muted">No saved prompts yet.</p>}
              {list.map((p) =>
                editing === p.id ? (
                  <div key={p.id} className="prompt-item editing">
                    <input value={p.title} onChange={(e) => update(p.id, { title: e.target.value })} placeholder="Name, e.g. About me" />
                    <textarea value={p.text} onChange={(e) => update(p.id, { text: e.target.value })} rows={6} autoFocus placeholder="Write your prompt…" />
                    <div className="row">
                      <button className="btn small primary" onClick={() => setEditing(null)}>Done</button>
                    </div>
                  </div>
                ) : (
                  <div key={p.id} className="prompt-item">
                    <b>{p.title || "Untitled"}</b>
                    <p className="pre">{p.text || <span className="muted">(empty)</span>}</p>
                    <div className="row">
                      <button className="btn small primary" disabled={!p.text.trim()} onClick={() => { onUse(p.text); setOpen(false); }}>Use in chat</button>
                      <button className="btn small" onClick={() => setEditing(p.id)}>Edit</button>
                      <button className="btn small" onClick={() => remove(p.id)}>Delete</button>
                    </div>
                  </div>
                )
              )}
            </div>
            <button className="btn block" onClick={add}>+ New prompt</button>
          </div>
        </div>
      )}
    </>
  );
}

// Puts a saved prompt in front of whatever is already typed.
export function withSaved(saved: string, current: string) {
  return current.trim() ? `${saved}\n\n${current}` : `${saved}\n\n`;
}
