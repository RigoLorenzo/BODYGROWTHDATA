"server only";
import { prisma } from "./prisma";
import { estimateDuration, isAbnormalDuration } from "./session-duration";

/** Sedute in palestra registrate nell'app (non importate da un orologio, non cardio) */
const GYM_SESSION = { status: "COMPLETED" as const, source: null, workoutType: { not: "CARDIO" as const } };

/** Durata stimata di una seduta dallo storico dell'utente (esclusa la seduta stessa) */
export async function estimateSessionDuration(
  userId: string,
  session: { id: string; programDayId: string | null }
): Promise<number> {
  const history = await prisma.workoutSession.findMany({
    where: { ...GYM_SESSION, userId, id: { not: session.id }, duration: { not: null } },
    select: { programDayId: true, duration: true },
    orderBy: { startedAt: "desc" },
    take: 200,
  });
  return estimateDuration(session, history);
}

/** Stato della durata di una seduta dell'utente: anomala o no, e la stima */
export async function durationCheck(userId: string, sessionId: string) {
  const s = await prisma.workoutSession.findFirst({
    where: { ...GYM_SESSION, id: sessionId, userId },
    select: { id: true, programDayId: true, duration: true },
  });
  if (!s) return null;
  const abnormal = isAbnormalDuration(s.duration);
  return { duration: s.duration, abnormal, estimate: abnormal ? await estimateSessionDuration(userId, s) : null };
}

/**
 * Corregge una seduta rimasta aperta per sbaglio: durata e fine diventano
 * quelle stimate dallo storico. Solo se la durata è davvero anomala (oltre 4 ore),
 * così la stessa richiesta ripetuta non cambia niente.
 */
export async function repairSessionDuration(userId: string, sessionId: string) {
  const s = await prisma.workoutSession.findFirst({
    where: { ...GYM_SESSION, id: sessionId, userId },
    select: { id: true, programDayId: true, startedAt: true, duration: true, restSeconds: true },
  });
  if (!s || !isAbnormalDuration(s.duration)) return null;
  const duration = await estimateSessionDuration(userId, s);
  const restSeconds = Math.min(s.restSeconds, duration);
  return prisma.workoutSession.update({
    where: { id: s.id },
    data: {
      duration,
      endedAt: new Date(s.startedAt.getTime() + duration * 1000),
      restSeconds,
      activeSeconds: duration - restSeconds,
    },
    select: { id: true, duration: true, endedAt: true },
  });
}
