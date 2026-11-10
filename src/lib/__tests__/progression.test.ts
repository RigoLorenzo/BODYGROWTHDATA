import { describe, expect, it } from "@jest/globals";
import { formatLoggedSets } from "../progression";

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
