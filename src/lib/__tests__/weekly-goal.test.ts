import { describe, expect, it } from "@jest/globals";
import { goalText, goalsFor, suggestSessionsGoal, weekProgress, weeksInARow, type WeekTotals } from "../weekly-goal";

const week = (w: string, gymSessions: number, runs = 0, km = 0): WeekTotals => ({ week: w, gymSessions, runs, km });

describe("goalsFor", () => {
  it("senza obiettivo scelto usa la frequenza del piano (non per la corsa)", () => {
    expect(goalsFor("BODYBUILDING", null, 4)).toEqual({ sessions: 4, km: null, runsCount: false });
    expect(goalsFor("RUNNING", { weeklyRunKmGoal: 25 }, 4)).toEqual({ sessions: null, km: 25, runsCount: true });
  });

  it("l'obiettivo scelto vince sul piano; i km solo per corsa e ibrido", () => {
    expect(goalsFor("HYBRID", { weeklySessionsGoal: 5, weeklyRunKmGoal: 20 }, 3)).toEqual({ sessions: 5, km: 20, runsCount: true });
    expect(goalsFor("POWERLIFTING", { weeklyRunKmGoal: 20 }, null)).toEqual({ sessions: null, km: null, runsCount: false });
  });
});

describe("weekProgress", () => {
  it("palestra: le corse non contano come sedute", () => {
    const p = weekProgress(week("w", 2, 1, 5), { sessions: 4, km: null, runsCount: false });
    expect(p.items).toEqual([{ kind: "sessions", done: 2, target: 4, ratio: 0.5, reached: false }]);
    expect(p.reached).toBe(false);
  });

  it("ibrido: sedute con le corse e km, raggiunto solo se lo sono tutti", () => {
    const goals = { sessions: 4, km: 20, runsCount: true };
    expect(weekProgress(week("w", 2, 2, 18), goals).reached).toBe(false);
    expect(weekProgress(week("w", 2, 2, 21), goals).reached).toBe(true);
  });
});

describe("weeksInARow", () => {
  const goals = { sessions: 3, km: null, runsCount: false };

  it("la settimana in corso non ancora raggiunta non rompe la serie", () => {
    expect(weeksInARow([week("1", 3), week("2", 4), week("3", 1)], goals)).toBe(2);
  });

  it("la settimana in corso raggiunta conta", () => {
    expect(weeksInARow([week("1", 3), week("2", 4), week("3", 3)], goals)).toBe(3);
  });

  it("una settimana mancata interrompe", () => {
    expect(weeksInARow([week("1", 3), week("2", 1), week("3", 3), week("4", 0)], goals)).toBe(1);
  });

  it("senza obiettivo è zero", () => {
    expect(weeksInARow([week("1", 5)], { sessions: null, km: null, runsCount: false })).toBe(0);
  });
});

describe("suggerimento e testo", () => {
  it("media delle ultime settimane attive, tra 1 e 7", () => {
    expect(suggestSessionsGoal([0, 3, 4, 0, 4])).toBe(4);
    expect(suggestSessionsGoal([])).toBe(3);
    expect(suggestSessionsGoal([12, 12])).toBe(7);
  });

  it("testo leggibile", () => {
    expect(goalText({ kind: "sessions", done: 2, target: 4, ratio: 0.5, reached: false })).toBe("2 di 4 sedute");
    expect(goalText({ kind: "km", done: 18.5, target: 25, ratio: 0.74, reached: false })).toBe("18,5 di 25 km");
  });
});
