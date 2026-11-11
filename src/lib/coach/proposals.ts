import type { CoachProposal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { programInputSchema, type ProgramInput } from "@/lib/program-schema";
import { assertExercisesUsable, createProgram } from "@/lib/program-writer";
import { toProgramInput, type ExerciseMeta } from "./proposal-checks";
import type { ProposeProgramInput } from "./tools/schemas";
import type { ProposalView } from "./types";

export { checkProposal, missingBriefSlots, type ExerciseMeta } from "./proposal-checks";

/**
 * Piani proposti dal Coach. Prima di essere mostrati passano controlli in
 * codice (esercizi esistenti, preferenze, attrezzatura, durata); diventano un
 * piano vero solo quando l'utente tocca "Applica".
 */

interface StoredPayload {
  program: ProgramInput;
  warnings: string[];
}

export async function loadExerciseMeta(userId: string, ids: string[]): Promise<Map<string, ExerciseMeta>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.exercise.findMany({
    where: { id: { in: ids }, OR: [{ isPublic: true }, { createdById: userId }, { isCustom: false }] },
    select: { id: true, name: true, nameIt: true, primaryMuscle: true, muscleGroups: true, equipment: true },
  });
  return new Map(rows.map((r) => [r.id, { ...r, name: r.nameIt ?? r.name }]));
}

export async function createProposal(
  userId: string,
  threadId: string,
  input: ProposeProgramInput,
  warnings: string[]
): Promise<CoachProposal> {
  const payload: StoredPayload = { program: toProgramInput(input), warnings };
  return prisma.coachProposal.create({
    data: { userId, threadId, payload: payload as never, rationale: input.rationale },
  });
}

export async function proposalViews(userId: string, ids: string[]): Promise<ProposalView[]> {
  if (ids.length === 0) return [];
  const proposals = await prisma.coachProposal.findMany({ where: { id: { in: ids }, userId } });
  const exerciseIds = proposals.flatMap((p) =>
    (p.payload as unknown as StoredPayload).program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))
  );
  const meta = await loadExerciseMeta(userId, Array.from(new Set(exerciseIds)));
  return proposals.map((p) => toView(p, meta));
}

export function toView(proposal: CoachProposal, meta: Map<string, ExerciseMeta>): ProposalView {
  const { program, warnings } = proposal.payload as unknown as StoredPayload;
  return {
    id: proposal.id,
    name: program.name,
    description: program.description ?? null,
    durationWeeks: program.durationWeeks,
    frequency: program.frequency,
    rationale: proposal.rationale,
    status: proposal.status as ProposalView["status"],
    programId: proposal.programId,
    warnings,
    days: program.days.map((day) => ({
      name: day.name,
      workoutType: day.workoutType,
      exercises: day.exercises.map((ex) => ({
        name: meta.get(ex.exerciseId)?.name ?? "Esercizio",
        sets: ex.sets,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        rpe: ex.rpe ?? null,
        restSeconds: ex.restSeconds,
        notes: ex.notes ?? null,
      })),
    })),
  };
}

export class ProposalNotFoundError extends Error {}
export class ProposalAlreadyHandledError extends Error {}

/**
 * Crea il piano e lo rende quello attivo. Si rivalida tutto: il contenuto
 * salvato non viene mai considerato fidato.
 */
export async function applyProposal(userId: string, proposalId: string): Promise<{ programId: string }> {
  return prisma.$transaction(
    async (tx) => {
      // Passaggio atomico pending → applied: con due richieste insieme solo una lo ottiene
      // (l'update blocca la riga e l'altra rilegge lo stato già cambiato)
      const claimed = await tx.coachProposal.updateMany({
        where: { id: proposalId, userId, status: "pending" },
        data: { status: "applied", appliedAt: new Date() },
      });
      if (claimed.count === 0) {
        const exists = await tx.coachProposal.count({ where: { id: proposalId, userId } });
        throw exists ? new ProposalAlreadyHandledError() : new ProposalNotFoundError();
      }
      const proposal = await tx.coachProposal.findFirstOrThrow({ where: { id: proposalId, userId } });

      const input = programInputSchema.parse((proposal.payload as unknown as StoredPayload).program);
      await assertExercisesUsable(tx, userId, input);
      const program = await createProgram(tx, userId, input);

      await tx.activeProgram.upsert({
        where: { userId },
        update: { programId: program.id, currentDay: 0, currentWeek: 1, startedAt: new Date(), completedAt: null },
        create: { userId, programId: program.id },
      });
      await tx.coachProposal.update({ where: { id: proposal.id }, data: { programId: program.id } });
      return { programId: program.id };
    },
    { timeout: 20_000 }
  );
}

export async function rejectProposal(userId: string, proposalId: string): Promise<void> {
  const result = await prisma.coachProposal.updateMany({
    where: { id: proposalId, userId, status: "pending" },
    data: { status: "rejected" },
  });
  if (result.count === 0) throw new ProposalNotFoundError();
}
