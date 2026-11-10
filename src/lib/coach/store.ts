import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localMidnight, localDate } from "./data/periods";
import type { StoredRole } from "./history";

/** Conversazioni del Coach nel database, sempre filtrate per utente */

export class ThreadNotFoundError extends Error {}

const titleFrom = (text: string) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
};

export async function openThread(userId: string, threadId: string | null, firstText: string) {
  if (threadId) {
    const thread = await prisma.coachThread.findFirst({ where: { id: threadId, userId }, select: { id: true } });
    if (!thread) throw new ThreadNotFoundError();
    return thread.id;
  }
  const thread = await prisma.coachThread.create({ data: { userId, title: titleFrom(firstText) }, select: { id: true } });
  return thread.id;
}

export async function loadStoredMessages(threadId: string) {
  return prisma.coachMessage.findMany({
    where: { threadId },
    orderBy: { seq: "asc" },
    select: { id: true, role: true, content: true },
  });
}

export async function appendMessage(threadId: string, role: StoredRole, content: unknown, usage?: unknown) {
  await prisma.$transaction([
    prisma.coachMessage.create({
      data: {
        threadId,
        role,
        content: content as Prisma.InputJsonValue,
        usage: usage === undefined ? undefined : (usage as Prisma.InputJsonValue),
      },
    }),
    prisma.coachThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date() } }),
  ]);
}

/** Messaggi scritti oggi dall'utente (per il limite giornaliero) */
export async function userMessagesToday(userId: string, now: Date) {
  return prisma.coachMessage.count({
    where: { role: "user", createdAt: { gte: localMidnight(localDate(now)) }, thread: { userId } },
  });
}

export async function listThreads(userId: string) {
  return prisma.coachThread.findMany({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
    take: 30,
    select: { id: true, title: true, lastMessageAt: true },
  });
}

export async function deleteThread(userId: string, threadId: string) {
  const result = await prisma.coachThread.deleteMany({ where: { id: threadId, userId } });
  if (result.count === 0) throw new ThreadNotFoundError();
}
