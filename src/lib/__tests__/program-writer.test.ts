import { describe, expect, it, jest } from "@jest/globals";
import type { Prisma } from "@prisma/client";
import { assertExercisesUsable, InvalidExercisesError, updateProgram } from "../program-writer";
import { programInputSchema } from "../program-schema";

/** Finto client di transazione: registra le chiamate senza database */
function fakeTx(existingDayIds: string[], usableExerciseIds: string[] = []) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, result: unknown = {}) =>
    jest.fn(async (args: unknown) => {
      (calls[name] ??= []).push(args);
      return result;
    });
  const tx = {
    program: { update: record("program.update") },
    programDay: {
      findMany: record("programDay.findMany", existingDayIds.map((id) => ({ id }))),
      deleteMany: record("programDay.deleteMany"),
      update: record("programDay.update"),
      create: record("programDay.create"),
    },
    programExercise: { deleteMany: record("programExercise.deleteMany") },
    exercise: { findMany: record("exercise.findMany", usableExerciseIds.map((id) => ({ id }))) },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, calls };
}

const input = programInputSchema.parse({
  name: "Piano",
  days: [
    { id: "day-a", name: "G1", exercises: [{ exerciseId: "e1", repsMin: 4, repsMax: 6, notes: "  " }] },
    { name: "G2 nuovo", exercises: [{ exerciseId: "e2" }] },
  ],
});

describe("updateProgram", () => {
  it("aggiorna i giorni esistenti, crea i nuovi ed elimina quelli tolti", async () => {
    const { tx, calls } = fakeTx(["day-a", "day-b"]);
    await updateProgram(tx, "p1", input);

    expect(calls["programDay.deleteMany"]).toEqual([{ where: { programId: "p1", id: { notIn: ["day-a"] } } }]);
    expect(calls["programExercise.deleteMany"]).toEqual([{ where: { dayId: "day-a" } }]);

    const updated = calls["programDay.update"][0] as { where: { id: string }; data: { dayIndex: number } };
    expect(updated.where.id).toBe("day-a");
    expect(updated.data.dayIndex).toBe(0);

    const created = calls["programDay.create"][0] as { data: { dayIndex: number; programId: string; name: string } };
    expect(created.data).toMatchObject({ dayIndex: 1, programId: "p1", name: "G2 nuovo" });
  });

  it("non aggiorna un id che non appartiene al piano (lo crea come nuovo)", async () => {
    const { tx, calls } = fakeTx(["day-x"]);
    await updateProgram(tx, "p1", input);
    expect(calls["programDay.update"]).toBeUndefined();
    expect(calls["programDay.create"]).toHaveLength(2);
  });

  it("salva le note vuote come null e mantiene l'ordine", async () => {
    const { tx, calls } = fakeTx(["day-a"]);
    await updateProgram(tx, "p1", input);
    const updated = calls["programDay.update"][0] as {
      data: { exercises: { create: { notes: string | null; orderIndex: number }[] } };
    };
    expect(updated.data.exercises.create[0]).toMatchObject({ notes: null, orderIndex: 0 });
  });
});

describe("assertExercisesUsable", () => {
  it("segnala gli esercizi inesistenti o di altri utenti", async () => {
    const { tx } = fakeTx([], ["e1"]);
    await expect(assertExercisesUsable(tx, "u1", input)).rejects.toBeInstanceOf(InvalidExercisesError);
  });

  it("passa se tutti gli esercizi sono disponibili", async () => {
    const { tx } = fakeTx([], ["e1", "e2"]);
    await expect(assertExercisesUsable(tx, "u1", input)).resolves.toBeUndefined();
  });
});
