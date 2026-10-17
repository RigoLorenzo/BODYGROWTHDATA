import { describe, expect, it } from "@jest/globals";
import { formatLoggedSets, suggestProgression, weightIncrement } from "../progression";

describe("suggestProgression", () => {
  it("senza storico non propone nulla", () => {
    expect(suggestProgression([], { repsMin: 8, repsMax: 10 }, 3)).toBeNull();
    expect(suggestProgression([{ weight: null, reps: null }], { repsMax: 10 }, 3)).toBeNull();
  });

  it("ripropone i numeri serie per serie se non hai chiuso il range", () => {
    const s = suggestProgression(
      [
        { weight: 80, reps: 6 },
        { weight: 80, reps: 5 },
        { weight: 77.5, reps: 6 },
      ],
      { repsMin: 4, repsMax: 6 },
      4
    );
    expect(s?.increase).toBe(false);
    expect(s?.sets).toEqual([
      { weight: 80, reps: 6 },
      { weight: 80, reps: 5 },
      { weight: 77.5, reps: 6 },
      { weight: 77.5, reps: 6 },
    ]);
  });

  it("propone +2,5 kg quando tutte le serie al peso più alto arrivano al massimo", () => {
    const s = suggestProgression(
      [
        { weight: 80, reps: 6 },
        { weight: 80, reps: 7 },
        { weight: 70, reps: 3 },
      ],
      { repsMin: 4, repsMax: 6 },
      3
    );
    expect(s?.increase).toBe(true);
    expect(s?.previousTop).toBe(80);
    expect(s?.sets).toEqual([
      { weight: 82.5, reps: 4 },
      { weight: 82.5, reps: 4 },
      { weight: 82.5, reps: 4 },
    ]);
  });

  it("senza massimo di ripetizioni nel piano non aumenta mai", () => {
    const s = suggestProgression([{ weight: 20, reps: 20 }], {}, 2);
    expect(s?.increase).toBe(false);
  });

  it("con pesi leggeri sale di 1 kg", () => {
    expect(weightIncrement(12)).toBe(1);
    expect(weightIncrement(20)).toBe(2.5);
    const s = suggestProgression([{ weight: 12, reps: 15 }], { repsMin: 12, repsMax: 15 }, 1);
    expect(s?.sets[0]).toEqual({ weight: 13, reps: 12 });
  });
});

describe("formatLoggedSets", () => {
  it("usa la virgola decimale e salta le serie vuote", () => {
    expect(
      formatLoggedSets([
        { weight: 82.5, reps: 5 },
        { weight: null, reps: 8 },
        { weight: 80, reps: 6 },
      ])
    ).toBe("82,5×5 · 80×6");
  });
});
