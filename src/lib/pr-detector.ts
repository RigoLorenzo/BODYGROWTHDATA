import { prisma } from "./prisma";
import { calculateOneRM } from "./one-rm-calculator";

export interface PRCandidate {
  exerciseId: string;
  weight?: number;
  reps?: number;
  volume?: number;
  oneRM?: number;
}

export interface PRResult {
  isNewRecord: boolean;
  recordType: "WEIGHT" | "REPS" | "VOLUME" | "ONE_RM";
  newValue: number;
  previousValue?: number;
  improvementPercent?: number;
}

export async function checkAndSavePersonalRecords(
  userId: string,
  sessionId: string,
  candidates: PRCandidate[]
): Promise<PRResult[]> {
  const results: PRResult[] = [];

  for (const candidate of candidates) {
    if (!candidate.exerciseId) continue;

    const checks: Array<{ type: "WEIGHT" | "REPS" | "VOLUME" | "ONE_RM"; value: number }> = [];

    if (candidate.weight && candidate.reps) {
      checks.push({ type: "WEIGHT", value: candidate.weight });
      const estimatedOneRM = calculateOneRM(candidate.weight, candidate.reps);
      checks.push({ type: "ONE_RM", value: Math.round(estimatedOneRM * 10) / 10 });
    }
    if (candidate.reps) {
      checks.push({ type: "REPS", value: candidate.reps });
    }
    if (candidate.volume) {
      checks.push({ type: "VOLUME", value: candidate.volume });
    }

    for (const check of checks) {
      const existing = await prisma.personalRecord.findFirst({
        where: { userId, exerciseId: candidate.exerciseId, recordType: check.type },
        orderBy: { value: "desc" },
      });

      if (!existing || check.value > existing.value) {
        const improvementPercent = existing
          ? ((check.value - existing.value) / existing.value) * 100
          : undefined;

        await prisma.personalRecord.create({
          data: {
            userId,
            exerciseId: candidate.exerciseId,
            recordType: check.type,
            value: check.value,
            weight: candidate.weight,
            reps: candidate.reps,
            previousRecord: existing?.value,
            improvementPercent,
            workoutSessionId: sessionId,
          },
        });

        results.push({
          isNewRecord: true,
          recordType: check.type,
          newValue: check.value,
          previousValue: existing?.value,
          improvementPercent,
        });
      }
    }
  }

  return results;
}

export async function getPersonalRecord(
  userId: string,
  exerciseId: string,
  type: "WEIGHT" | "REPS" | "VOLUME" | "ONE_RM"
) {
  return prisma.personalRecord.findFirst({
    where: { userId, exerciseId, recordType: type },
    orderBy: { value: "desc" },
  });
}
