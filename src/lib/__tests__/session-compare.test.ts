import { describe, expect, it } from "@jest/globals";
import { compareSessions, type SessionTotals } from "../session-compare";

const totals = (tonnage: number, workingSets: number, reps: number): SessionTotals => ({
  startedAt: "2026-11-04T17:00:00.000Z",
  tonnage,
  workingSets,
  reps,
});

describe("compareSessions", () => {
  it("scrive le differenze con segno e unità all'italiana", () => {
    const diffs = compareSessions(totals(4520, 18, 140), totals(4200, 20, 140));
    expect(diffs.map((d) => d.text)).toEqual(["+320 kg", "−2", "uguale"]);
    expect(diffs.map((d) => d.diff)).toEqual([320, -2, 0]);
  });

  it("decimali e migliaia", () => {
    const [volume] = compareSessions(totals(5250.5, 10, 50), totals(4000, 10, 50));
    expect(volume.text).toBe("+1.250,5 kg");
  });
});
