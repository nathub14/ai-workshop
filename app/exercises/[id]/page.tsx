import { notFound } from "next/navigation";
import { EXERCISE_BOTS, getBot, publicBot } from "@/lib/exerciseBots";
import ExerciseChat from "../ExerciseChat";

export function generateStaticParams() {
  return EXERCISE_BOTS.map((b) => ({ id: b.id }));
}

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const bot = getBot((await params).id);
  if (!bot) notFound();
  // Only the public fields go to the browser; the system prompt stays on the server.
  return <ExerciseChat bot={publicBot(bot)} />;
}
