export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coachUser } from "@/lib/coach/guard";
import { toDisplay } from "@/lib/coach/history";
import { proposalViews } from "@/lib/coach/proposals";
import { deleteThread, loadStoredMessages, ThreadNotFoundError } from "@/lib/coach/store";
import type { DisplayMessage } from "@/lib/coach/types";

interface Params { params: Promise<{ id: string }> }

/** Messaggi di una conversazione, pronti per la chat, con le proposte di piano */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const guard = await coachUser();
  if ("response" in guard) return guard.response;

  const thread = await prisma.coachThread.findFirst({ where: { id, userId: guard.userId }, select: { id: true, title: true } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = toDisplay(await loadStoredMessages(id)) as DisplayMessage[];
  const proposalIds = messages.flatMap((m) => (m.role === "assistant" ? m.proposalIds : []));
  const proposals = await proposalViews(guard.userId, proposalIds);
  return NextResponse.json({ id: thread.id, title: thread.title, messages, proposals });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const guard = await coachUser();
  if ("response" in guard) return guard.response;
  try {
    await deleteThread(guard.userId, id);
  } catch (error) {
    if (error instanceof ThreadNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw error;
  }
  return NextResponse.json({ success: true });
}
