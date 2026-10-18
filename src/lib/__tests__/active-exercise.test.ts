import { describe, expect, it } from "@jest/globals";
import { buildActiveExercise } from "../active-exercise";

const seed = { id: "x", exerciseId: "e1", exerciseName: "Squat", orderIndex: 0, sets: 3, repsMin: 5, repsMax: 8 };

describe("buildActiveExercise", () => {
  it("senza storico crea le serie del piano vuote", () => {
    const ex = buildActiveExercise(seed);
    expect(ex.sets).toHaveLength(3);
    expect(ex.sets.every((s) => s.weight == null && !s.prefilled)).toBe(true);
    expect(ex.lastSets).toBeUndefined();
  });

  it("con storico precompila le serie come proposta (da confermare)", () => {
    const ex = buildActiveExercise(seed, {
      date: "2026-10-10",
      sets: [
        { weight: 100, reps: 8 },
        { weight: 100, reps: 8 },
        { weight: 100, reps: 8 },
      ],
    });
    expect(ex.progression).toEqual({ increase: true, previousTop: 100 });
    expect(ex.lastDate).toBe("2026-10-10");
    expect(ex.sets[0]).toMatchObject({ weight: 102.5, reps: 5, prefilled: true, completed: false });
  });

  it("per un esercizio fuori piano riprende il numero di serie dell'ultima volta", () => {
    const ex = buildActiveExercise(
      { id: "y", exerciseId: "e2", exerciseName: "Curl", orderIndex: 1 },
      { date: "2026-10-10", sets: [{ weight: 14, reps: 10 }, { weight: 14, reps: 9 }] }
    );
    expect(ex.sets).toHaveLength(2);
    expect(ex.sets[1]).toMatchObject({ weight: 14, reps: 9 });
  });

  it("segnala se lo storico viene dallo stesso giorno del piano", () => {
    const ex = buildActiveExercise(seed, { date: "2026-10-10", sameDay: true, sets: [{ weight: 60, reps: 6 }] });
    expect(ex.lastSameDay).toBe(true);
  });
});
