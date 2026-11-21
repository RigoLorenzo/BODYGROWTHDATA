import { describe, expect, it } from "@jest/globals";
import { setDelta } from "../set-delta";

describe("setDelta", () => {
  it("con peso e ripetizioni confronta il volume", () => {
    // 15 kg × 10 = 150; 6,25 kg × 12 = 75
    expect(setDelta({ weight: 15, reps: 10 }, { weight: 6.25, reps: 12 })).toEqual({ kind: "volume", diff: -75 });
    // meno peso ma più ripetizioni: volume in crescita
    expect(setDelta({ weight: 80, reps: 8 }, { weight: 75, reps: 10 })).toEqual({ kind: "volume", diff: 110 });
    expect(setDelta({ weight: 80, reps: 8 }, { weight: 80, reps: 8 })).toEqual({ kind: "volume", diff: 0 });
  });

  it("a corpo libero confronta le ripetizioni", () => {
    expect(setDelta({ weight: null, reps: 10 }, { reps: 12 })).toEqual({ kind: "reps", diff: 2 });
  });

  it("senza ripetizioni confronta il peso", () => {
    expect(setDelta({ weight: 80, reps: null }, { weight: 82.5 })).toEqual({ kind: "weight", diff: 2.5 });
  });

  it("senza dati confrontabili niente confronto", () => {
    expect(setDelta({ weight: 80, reps: 8 }, {})).toBeNull();
    expect(setDelta({ weight: null, reps: null }, { weight: 80, reps: 8 })).toBeNull();
  });
});
