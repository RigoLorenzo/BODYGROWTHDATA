import { describe, expect, it } from "@jest/globals";
import { exerciseLibrary } from "@/lib/exercise-library";
import { humanizeCode, libraryIndex, matchGarminExercise, setsFromSummary } from "../exercise-match";

const index = libraryIndex(exerciseLibrary);

describe("esercizi Garmin → libreria", () => {
  it("sottocategoria con lo stesso nome della libreria", () => {
    expect(matchGarminExercise(index, "BENCH_PRESS", "BARBELL_BENCH_PRESS")).toMatchObject({
      libraryName: "Barbell Bench Press",
      muscle: "CHEST",
      sourceName: null,
    });
    expect(matchGarminExercise(index, "ROW", "BARBELL_ROW").libraryName).toBe("Barbell Row");
  });

  it("senza l'attrezzo davanti (BARBELL_BACK_SQUAT → Back Squat)", () => {
    expect(matchGarminExercise(index, "SQUAT", "BARBELL_BACK_SQUAT").libraryName).toBe("Back Squat");
  });

  it("variante sconosciuta: esercizio tipico della categoria, nome Garmin come nota", () => {
    expect(matchGarminExercise(index, "CURL", "STANDING_ALTERNATING_DUMBBELL_CURLS")).toMatchObject({
      libraryName: "Dumbbell Curl",
      muscle: "BICEPS",
      sourceName: "Standing Alternating Dumbbell Curls",
    });
  });

  it("categoria sconosciuta o non classificata: esercizio personalizzato", () => {
    expect(matchGarminExercise(index, "BATTLE_ROPE", "BATTLE_ROPE_ALTERNATING_WAVE")).toMatchObject({
      libraryName: null,
      customName: "Battle Rope Alternating Wave",
      muscle: "FULL_BODY",
    });
    expect(matchGarminExercise(index, "UNKNOWN", null).customName).toBe("Esercizio non classificato");
  });

  it("nomi leggibili dai codici", () => {
    expect(humanizeCode("TRICEPS_EXTENSION")).toBe("Triceps Extension");
  });
});

describe("serie dai totali dell'orologio", () => {
  it("ripetizioni divise tra le serie, carico medio, volume esatto", () => {
    const sets = setsFromSummary({ sets: 4, reps: 30, volumeKg: 2400 });
    expect(sets.map((s) => s.reps)).toEqual([8, 8, 7, 7]);
    expect(sets.every((s) => s.weight === 80)).toBe(true);
    expect(sets.reduce((v, s) => v + (s.reps ?? 0) * (s.weight ?? 0), 0)).toBe(2400);
  });

  it("corpo libero: niente carico", () => {
    expect(setsFromSummary({ sets: 3, reps: 36, volumeKg: 0 })).toEqual([
      { reps: 12, weight: null },
      { reps: 12, weight: null },
      { reps: 12, weight: null },
    ]);
  });

  it("serie senza ripetizioni (es. plank a tempo)", () => {
    expect(setsFromSummary({ sets: 2, reps: 0 })).toEqual([
      { reps: null, weight: null },
      { reps: null, weight: null },
    ]);
  });
});
