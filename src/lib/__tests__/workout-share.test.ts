import { describe, expect, it } from "@jest/globals";
import {
  buildWorkoutShareStats,
  formatNumberIt,
  formatShareDuration,
  safeTimeZone,
  splitTonnage,
  timeOfDayTitle,
  zonedDateParts,
  type ShareExerciseLike,
} from "../workout-share";

const exercise = (name: string, muscle: string, sets: ShareExerciseLike["sets"]): ShareExerciseLike => ({
  exercise: { name, primaryMuscle: muscle },
  sets,
});

const working = (weight: number, reps: number) => ({ type: "WORKING", weight, reps });

describe("formatNumberIt", () => {
  it("usa punto per le migliaia e virgola per i decimali", () => {
    expect(formatNumberIt(12840)).toBe("12.840");
    expect(formatNumberIt(82.5, 1)).toBe("82,5");
    expect(formatNumberIt(100, 1)).toBe("100");
  });
});

describe("splitTonnage", () => {
  it("passa alle tonnellate oltre i 1000 kg", () => {
    expect(splitTonnage(7740)).toEqual({ value: "7,7", unit: "t" });
    expect(splitTonnage(6015)).toEqual({ value: "6,0", unit: "t" });
    expect(splitTonnage(840)).toEqual({ value: "840", unit: "kg" });
  });
});

describe("formatShareDuration", () => {
  it("mostra minuti o ore e minuti", () => {
    expect(formatShareDuration(48 * 60)).toBe("48 min");
    expect(formatShareDuration(73 * 60)).toBe("1h 13m");
    expect(formatShareDuration(3600)).toBe("1h");
  });
});

describe("zonedDateParts", () => {
  it("formatta nel fuso di chi condivide, non in quello del server", () => {
    const parts = zonedDateParts("2026-10-28T17:32:00Z", "Europe/Rome");
    expect(parts.timeLabel).toBe("18:32");
    expect(parts.hour).toBe(18);
    expect(parts.dateLabel).toBe("mercoledì 28 ottobre 2026");
  });
  it("ignora fusi non validi", () => {
    expect(safeTimeZone("Marte/Olympus")).toBe("Europe/Rome");
    expect(safeTimeZone("America/New_York")).toBe("America/New_York");
  });
});

describe("timeOfDayTitle", () => {
  it("dà un titolo in base all'ora", () => {
    expect(timeOfDayTitle(7)).toBe("Allenamento mattutino");
    expect(timeOfDayTitle(19)).toBe("Allenamento serale");
    expect(timeOfDayTitle(2)).toBe("Allenamento notturno");
  });
});

describe("buildWorkoutShareStats", () => {
  const workout = {
    startedAt: "2026-10-28T17:00:00Z",
    endedAt: "2026-10-28T18:10:00Z",
    exercises: [
      exercise("Bench Press", "CHEST", [
        { type: "WARMUP", weight: 40, reps: 10 },
        working(100, 6),
        working(100, 5),
      ]),
      exercise("Dips", "TRICEPS", [working(0, 12), working(0, 10)]),
      exercise("Lateral Raise", "SHOULDERS", [working(12, 15), working(12, 15)]),
      exercise("Plank", "CORE", []),
    ],
    personalRecords: [
      { recordType: "ONE_RM", value: 117.5, exercise: { name: "Bench Press" } },
      { recordType: "WEIGHT", value: 100, exercise: { name: "Bench Press" } },
    ],
  };
  const stats = buildWorkoutShareStats(workout);

  it("esclude il riscaldamento da tonnellaggio, serie e ripetizioni", () => {
    expect(stats.tonnage).toBe(100 * 6 + 100 * 5 + 12 * 15 * 2);
    expect(stats.workingSets).toBe(6);
    expect(stats.reps).toBe(6 + 5 + 12 + 10 + 15 + 15);
  });

  it("conta solo gli esercizi con serie svolte", () => {
    expect(stats.exerciseCount).toBe(3);
    expect(stats.exercises.map((e) => e.name)).toEqual(["Bench Press", "Dips", "Lateral Raise"]);
  });

  it("riassume le serie in modo leggibile", () => {
    expect(stats.exercises.map((e) => e.summary)).toEqual([
      "2 × 5-6 · 100 kg",
      "2 serie · max 12 rip.",
      "2 × 15 · 12 kg",
    ]);
  });

  it("individua la serie più pesante", () => {
    expect(stats.topSet).toEqual({ exerciseName: "Bench Press", weight: 100, reps: 6 });
  });

  it("mostra un solo record per esercizio, il carico prima del 1RM", () => {
    expect(stats.records).toEqual([{ exerciseName: "Bench Press", label: "100 kg" }]);
    expect(stats.exercises[0].pr).toBe("100 kg");
  });

  it("calcola la durata dagli orari se manca quella salvata", () => {
    expect(stats.durationSeconds).toBe(70 * 60);
  });

  it("ripartisce le serie per muscolo", () => {
    expect(stats.muscles.map((m) => [m.muscle, m.sets])).toEqual([
      ["CHEST", 2],
      ["TRICEPS", 2],
      ["SHOULDERS", 2],
    ]);
    expect(stats.muscles.reduce((sum, m) => sum + m.share, 0)).toBeCloseTo(1);
  });
});
