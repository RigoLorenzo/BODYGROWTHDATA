import { prisma } from "@/lib/prisma";
import { isCoachOwner, levelFrom, type CoachLevel } from "./access-rules";

export * from "./access-rules";

/**
 * Livello di accesso letto dal database. L'abbonamento a pagamento si
 * aggiungerà qui, senza toccare chi chiama queste funzioni.
 */
export async function coachLevel(userId: string | undefined | null): Promise<CoachLevel> {
  if (!userId) return "none";
  if (isCoachOwner(userId)) return "owner";
  const access = await prisma.coachAccess.findUnique({ where: { userId }, select: { revokedAt: true } });
  return levelFrom(userId, access);
}

export async function hasCoachAccess(userId: string | undefined | null): Promise<boolean> {
  return (await coachLevel(userId)) !== "none";
}
