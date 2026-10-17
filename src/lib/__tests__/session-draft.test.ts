import { describe, expect, it } from "@jest/globals";
import { draftFromSession, sessionFromDraft } from "../session-draft";
import type { ActiveSession } from "@/types";

const session: ActiveSession = {
  id: "s1",
  startedAt: new Date("2026-10-17T10:00:00Z"),
  programDayId: "d1",
  programDayName: "G1 — Panca",
  exercises: [
    {
      id: "plan-1",
      exerciseId: "e1",
      exerciseName: "Barbell Bench Press",
      exerciseNameIt: "Panca piana",
      orderIndex: 0,
      restTimerSeconds: 180,
      fromPlan: true,
      targetSets: 2,
      sets: [
        { setNumber: 1, type: "WORKING", weight: 80, reps: 5, completed: true },
        { setNumber: 2, type: "WORKING", weight: 80, reps: 5, completed: false, prefilled: true },
      ],
    },
  ],
};

describe("bozza dell'allenamento", () => {
  it("andata e ritorno conserva serie spuntate e non spuntate", () => {
    const draft = JSON.parse(JSON.stringify(draftFromSession(session)));
    const restored = sessionFromDraft({ id: "s1", startedAt: "2026-10-17T10:00:00Z", programDayId: "d1" }, draft);
    expect(restored?.programDayName).toBe("G1 — Panca");
    expect(restored?.exercises[0].sets).toEqual([
      expect.objectContaining({ weight: 80, reps: 5, completed: true }),
      expect.objectContaining({ weight: 80, reps: 5, completed: false, prefilled: true }),
    ]);
  });

  it("una bozza assente o corrotta non rompe la ripresa", () => {
    const base = { id: "s1", startedAt: "2026-10-17T10:00:00Z", programDayId: null };
    expect(sessionFromDraft(base, null)).toBeNull();
    expect(sessionFromDraft(base, { exercises: [{ id: 1 }] })).toBeNull();
  });
});
