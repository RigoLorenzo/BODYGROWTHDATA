import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { coachLevel } from "./access";
import { estimateCostUsd, roundCost } from "./costs";
import { generateInviteCode, normalizeInviteCode } from "./invite-code";

/**
 * Lista d'attesa, inviti e accessi dei tester. Le scritture che contano
 * (usi di un codice) sono atomiche: lo stesso codice non si usa più volte
 * del previsto nemmeno con richieste contemporanee.
 */

export type RedeemResult = "granted" | "already" | "invalid";

/** Il codice è usabile adesso? (per la pagina /invito, senza consumarlo) */
export async function inviteStatus(rawCode: string): Promise<{ code: string; label: string } | null> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return null;
  const invite = await prisma.coachInvite.findUnique({ where: { code } });
  if (!invite || invite.disabled || invite.uses >= invite.maxUses) return null;
  if (invite.expiresAt && invite.expiresAt <= new Date()) return null;
  return { code, label: invite.label };
}

export async function redeemInvite(userId: string, rawCode: string): Promise<RedeemResult> {
  const code = normalizeInviteCode(rawCode);
  if (!code) return "invalid";
  // Chi ha già accesso non consuma un uso del codice
  if ((await coachLevel(userId)) !== "none") return "already";

  return prisma.$transaction(async (tx) => {
    // Un solo UPDATE condizionale: due richieste insieme non superano maxUses
    const used = await tx.$queryRaw<{ code: string }[]>`
      UPDATE "CoachInvite" SET "uses" = "uses" + 1
      WHERE "code" = ${code} AND "disabled" = false AND "uses" < "maxUses"
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
      RETURNING "code"`;
    if (used.length === 0) return "invalid";
    await tx.coachAccess.upsert({
      where: { userId },
      update: { source: "invite", inviteCode: code, grantedAt: new Date(), revokedAt: null },
      create: { userId, source: "invite", inviteCode: code },
    });
    await tx.coachWaitlist.deleteMany({ where: { userId } });
    return "granted";
  });
}

export async function joinWaitlist(userId: string, note: string | null) {
  await prisma.coachWaitlist.upsert({
    where: { userId },
    update: { note },
    create: { userId, note },
  });
}

export async function leaveWaitlist(userId: string) {
  await prisma.coachWaitlist.deleteMany({ where: { userId } });
}

export async function waitlistEntry(userId: string) {
  return prisma.coachWaitlist.findUnique({ where: { userId }, select: { note: true, createdAt: true } });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function createInvite(input: { label: string; maxUses: number; expiresInDays: number | null }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const exists = await prisma.coachInvite.findUnique({ where: { code }, select: { code: true } });
    if (exists) continue;
    return prisma.coachInvite.create({
      data: {
        code,
        label: input.label,
        maxUses: input.maxUses,
        expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
      },
    });
  }
  throw new Error("Impossibile generare un codice univoco");
}

export async function setInviteDisabled(code: string, disabled: boolean) {
  const result = await prisma.coachInvite.updateMany({ where: { code }, data: { disabled } });
  return result.count === 1;
}

export async function grantAccess(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return false;
  const waitlisted = await prisma.coachWaitlist.findUnique({ where: { userId }, select: { userId: true } });
  await prisma.$transaction([
    prisma.coachAccess.upsert({
      where: { userId },
      update: { revokedAt: null, grantedAt: new Date() },
      create: { userId, source: waitlisted ? "waitlist" : "admin" },
    }),
    prisma.coachWaitlist.deleteMany({ where: { userId } }),
  ]);
  return true;
}

export async function revokeAccess(userId: string) {
  const result = await prisma.coachAccess.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return result.count === 1;
}

const person = (u: { id: string; name: string | null; email: string | null }) => ({ userId: u.id, name: u.name, email: u.email });

/** Tutto ciò che serve alla pagina admin, con messaggi e costo degli ultimi 30 giorni */
export async function adminOverview(now = new Date()) {
  const since = subDays(now, 30);
  const [waitlist, access, invites, assistant, userMessages] = await Promise.all([
    prisma.coachWaitlist.findMany({
      orderBy: { createdAt: "asc" },
      select: { note: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.coachAccess.findMany({
      orderBy: { grantedAt: "desc" },
      select: { source: true, inviteCode: true, grantedAt: true, revokedAt: true, user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.coachInvite.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.coachMessage.findMany({
      where: { role: "assistant", createdAt: { gte: since } },
      select: { usage: true, thread: { select: { userId: true } } },
    }),
    prisma.coachMessage.groupBy({ by: ["threadId"], where: { role: "user", createdAt: { gte: since } }, _count: true }),
  ]);

  const threadOwners = new Map(
    (
      await prisma.coachThread.findMany({
        where: { id: { in: userMessages.map((m) => m.threadId) } },
        select: { id: true, userId: true },
      })
    ).map((t) => [t.id, t.userId])
  );

  const cost = new Map<string, number>();
  for (const m of assistant) cost.set(m.thread.userId, (cost.get(m.thread.userId) ?? 0) + estimateCostUsd(m.usage));
  const messages = new Map<string, number>();
  for (const m of userMessages) {
    const owner = threadOwners.get(m.threadId);
    if (owner) messages.set(owner, (messages.get(owner) ?? 0) + m._count);
  }

  const usageOf = (userId: string) => ({ messages30d: messages.get(userId) ?? 0, costUsd30d: roundCost(cost.get(userId) ?? 0) });

  return {
    totalCostUsd30d: roundCost(Array.from(cost.values()).reduce((s, c) => s + c, 0)),
    waitlist: waitlist.map((w) => ({ ...person(w.user), note: w.note, createdAt: w.createdAt.toISOString() })),
    testers: access.map((a) => ({
      ...person(a.user),
      source: a.source,
      inviteCode: a.inviteCode,
      grantedAt: a.grantedAt.toISOString(),
      revokedAt: a.revokedAt?.toISOString() ?? null,
      ...usageOf(a.user.id),
    })),
    invites: invites.map((i) => ({
      code: i.code,
      label: i.label,
      maxUses: i.maxUses,
      uses: i.uses,
      expiresAt: i.expiresAt?.toISOString() ?? null,
      disabled: i.disabled,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

export type AdminOverview = Awaited<ReturnType<typeof adminOverview>>;
