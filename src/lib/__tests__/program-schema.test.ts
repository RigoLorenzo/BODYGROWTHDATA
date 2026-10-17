import { describe, expect, it } from "@jest/globals";
import { programInputSchema } from "../program-schema";

const base = {
  name: "  Piano  ",
  days: [{ name: "G1", exercises: [{ exerciseId: "ex1", sets: 3, repsMin: 8, repsMax: 10 }] }],
};

describe("programInputSchema", () => {
  it("applica i default e ripulisce i testi", () => {
    const parsed = programInputSchema.parse(base);
    expect(parsed.name).toBe("Piano");
    expect(parsed.frequency).toBe(3);
    expect(parsed.days[0].workoutType).toBe("CUSTOM");
    expect(parsed.days[0].exercises[0].restSeconds).toBe(90);
  });

  it("rifiuta reps max minori delle reps min", () => {
    const bad = { ...base, days: [{ name: "G1", exercises: [{ exerciseId: "x", repsMin: 10, repsMax: 8 }] }] };
    expect(programInputSchema.safeParse(bad).success).toBe(false);
  });

  it("rifiuta nomi vuoti e valori fuori scala", () => {
    expect(programInputSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
    const tooMany = { ...base, days: [{ name: "G1", exercises: [{ exerciseId: "x", sets: 50 }] }] };
    expect(programInputSchema.safeParse(tooMany).success).toBe(false);
  });

  it("accetta RPE e note opzionali", () => {
    const ok = {
      ...base,
      days: [{ name: "G1", exercises: [{ exerciseId: "x", repsMin: 4, repsMax: 6, rpe: 9, notes: "RIR 1" }] }],
    };
    expect(programInputSchema.parse(ok).days[0].exercises[0]).toMatchObject({ rpe: 9, notes: "RIR 1" });
  });
});
