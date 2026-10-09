import Link from "next/link";
import { EXERCISE_BOTS } from "@/lib/exerciseBots";

export const metadata = { title: "Exercises · AI Launch Lab" };

export default function Exercises() {
  return (
    <main className="ex-page">
      <div className="ex-wrap">
        <Link href="/" className="ex-back">← Back to the Lab</Link>
        <h1>Exercises</h1>
        <p className="muted ex-intro">Each bot has one AI weakness, turned up to the max. Find it, then find the prompt that fixes it.</p>
        <div className="ex-list">
          {EXERCISE_BOTS.map((b, i) => (
            <Link key={b.id} href={`/exercises/${b.id}`} className="ex-card">
              <span className="ex-num">{i + 1}</span>
              <span className="ex-body">
                <b>{b.name}</b>
                <span>{b.description}</span>
                <span className="ex-badge">Training bot – exaggerates a real AI weakness on purpose</span>
              </span>
              <span className="ex-go">→</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
