import type { Prisma } from "@prisma/client";
import type { ProgramDayInput, ProgramInput } from "./program-schema";

type Tx = Prisma.TransactionClient;

export class InvalidExercisesError extends Error {
  constructor(readonly ids: string[]) {
    super(`Esercizi non disponibili: ${ids.join(", ")}`);
    this.name = "InvalidExercisesError";
  }
}

/** Gli esercizi devono esistere ed essere della libreria o dell'utente stesso */
export async function assertExercisesUsable(tx: Tx, userId: string, input: ProgramInput) {
  const ids = Array.from(new Set(input.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
  if (!ids.length) return;
  const found = await tx.exercise.findMany({
    where: { id: { in: ids }, OR: [{ isPublic: true }, { createdById: userId }, { isCustom: false }] },
    select: { id: true },
  });
  const ok = new Set(found.map((e) => e.id));
  const missing = ids.filter((id) => !ok.has(id));
  if (missing.length) throw new InvalidExercisesError(missing);
}

const programFields = (input: ProgramInput) => ({
  name: input.name,
  description: input.description ?? null,
  frequency: input.frequency,
  durationWeeks: input.durationWeeks,
  splitType: input.splitType,
});

const exerciseRows = (day: ProgramDayInput) =>
  day.exercises.map((ex, orderIndex) => ({
    exerciseId: ex.exerciseId,
    orderIndex,
    sets: ex.sets,
    repsMin: ex.repsMin,
    repsMax: ex.repsMax,
    rpe: ex.rpe ?? null,
    restSeconds: ex.restSeconds,
    notes: ex.notes || null,
  }));

export async function createProgram(tx: Tx, userId: string, input: ProgramInput) {
  return tx.program.create({
    data: {
      ...programFields(input),
      creatorId: userId,
      days: {
        create: input.days.map((day, dayIndex) => ({
          dayIndex,
          name: day.name,
          workoutType: day.workoutType,
          exercises: { create: exerciseRows(day) },
        })),
      },
    },
  });
}

/**
 * Sostituisce il contenuto del piano. I giorni con `id` vengono aggiornati sul
 * posto (gli allenamenti già fatti restano collegati), quelli nuovi creati,
 * quelli tolti eliminati.
 */
export async function updateProgram(tx: Tx, programId: string, input: ProgramInput) {
  await tx.program.update({ where: { id: programId }, data: programFields(input) });

  const existing = await tx.programDay.findMany({ where: { programId }, select: { id: true } });
  const existingIds = new Set(existing.map((d) => d.id));
  const keptIds = new Set(input.days.map((d) => d.id).filter((id): id is string => !!id && existingIds.has(id)));

  await tx.programDay.deleteMany({ where: { programId, id: { notIn: Array.from(keptIds) } } });

  for (const [dayIndex, day] of input.days.entries()) {
    const data = { dayIndex, name: day.name, workoutType: day.workoutType };
    if (day.id && keptIds.has(day.id)) {
      await tx.programExercise.deleteMany({ where: { dayId: day.id } });
      await tx.programDay.update({
        where: { id: day.id },
        data: { ...data, exercises: { create: exerciseRows(day) } },
      });
    } else {
      await tx.programDay.create({ data: { ...data, programId, exercises: { create: exerciseRows(day) } } });
    }
  }
}
