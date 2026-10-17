import { describe, expect, it } from "@jest/globals";
import { plannedMuscleVolume, repsLabel, splitDayName } from "../plan-format";

describe("splitDayName", () => {
  it("separa il codice del giorno dal titolo", () => {
    expect(splitDayName("G2 — Gambe A · Deltoidi", 1)).toEqual({ code: "G2", title: "Gambe A · Deltoidi" });
  });
  it("senza codice usa la posizione", () => {
    expect(splitDayName("Petto e tricipiti", 2)).toEqual({ code: "G3", title: "Petto e tricipiti" });
  });
});

describe("repsLabel", () => {
  it("mostra un numero solo se min e max coincidono", () => {
    expect(repsLabel(12, 12)).toBe("12");
    expect(repsLabel(8, 12)).toBe("8-12");
  });
});

describe("plannedMuscleVolume", () => {
  it("conta le serie dirette e quelle pesate dei secondari", () => {
    const volume = Object.fromEntries(
      plannedMuscleVolume([
        { sets: 4, exercise: { primaryMuscle: "CHEST", muscleGroups: ["CHEST", "TRICEPS", "SHOULDERS"] } },
        { sets: 3, exercise: { primaryMuscle: "TRICEPS", muscleGroups: ["TRICEPS"] } },
        { sets: 2, exercise: null },
      ])
    );
    expect(volume.CHEST).toEqual({ direct: 4, weighted: 4 });
    expect(volume.TRICEPS).toEqual({ direct: 3, weighted: 5 }); // 3 + 4×0,5
    expect(volume.SHOULDERS).toEqual({ direct: 0, weighted: 1 }); // 4×0,25
  });
});
