export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { coachUser } from "@/lib/coach/guard";
import { listThreads } from "@/lib/coach/store";
import type { ThreadSummary } from "@/lib/coach/types";

/** Le conversazioni recenti con il Coach */
export async function GET() {
  const guard = await coachUser();
  if ("response" in guard) return guard.response;
  const threads = await listThreads(guard.userId);
  const body: ThreadSummary[] = threads.map((t) => ({ id: t.id, title: t.title, lastMessageAt: t.lastMessageAt.toISOString() }));
  return NextResponse.json(body);
}
