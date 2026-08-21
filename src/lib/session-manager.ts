"server only";

import { prisma } from "./prisma";
import { calculateSessionVolume } from "./volume-calculator";
import { checkAndSavePersonalRecords } from "./pr-detector";
import { updateUserStreak } from "./streak-calculator";

export async function finalizeSession(
  sessionId: string,
  userId: string,
  opts: { restSeconds?: number } = {}
) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId, userId },
    include: {
      exercises: {
        include: {
          sets: true,
          exercise: { select: { id: true } },
        },
      },
    },
  });

  if (!session) throw new Error("Session not found");

  const totalVolume = calculateSessionVolume(
    session.exercises.map((e) => ({ sets: e.sets }))
  );

  const totalSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.type !== "WARMUP").length,
    0
  );

  const totalReps = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps ?? 0), 0),
    0
  );

  const duration = session.endedAt
    ? Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
    : Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

  // Tempo di recupero cronometrato durante la sessione: il resto della durata
  // è tempo di lavoro effettivo.
  const restSeconds = Math.max(0, Math.min(Math.round(opts.restSeconds ?? 0), duration));
  const activeSeconds = Math.max(0, duration - restSeconds);

  await prisma.workoutSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      duration,
      totalVolume,
      totalSets,
      totalReps,
      restSeconds,
      activeSeconds,
    },
  });

  // Check PRs per exercise
  const prCandidates = session.exercises.map((ex) => {
    const workingSets = ex.sets.filter((s) => s.type !== "WARMUP" && s.weight && s.reps);
    const maxWeight = Math.max(...workingSets.map((s) => s.weight ?? 0));
    const maxReps = Math.max(...workingSets.map((s) => s.reps ?? 0));
    const volume = workingSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);

    return {
      exerciseId: ex.exerciseId,
      weight: maxWeight || undefined,
      reps: maxReps || undefined,
      volume: volume || undefined,
    };
  });

  await checkAndSavePersonalRecords(userId, sessionId, prCandidates);
  await updateUserStreak(userId);

  return { sessionId, totalVolume, totalSets, totalReps, restSeconds, activeSeconds };
}
