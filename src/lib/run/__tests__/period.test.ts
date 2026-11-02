import { describe, expect, it } from "@jest/globals";
import { periodWindow } from "@/lib/insights";
import { monthlyRunTotals, runPeriod, runTotals, weeksOnGoal, type RunEntry } from "../period";

let n = 0;
const run = (d: Date, km: number, minutes: number, elevation = 0): RunEntry => ({
  id: `r${n++}`,
  startedAt: d,
  distance: km * 1000,
  movingTime: minutes * 60,
  elevationGain: elevation,
});

// Domenica 18 ottobre 2026
const NOW = new Date(2026, 9, 18, 20, 0);
const runs = [
  run(new Date(2026, 9, 12, 7), 10, 50, 40), // settimana 12-18: 5:00/km
  run(new Date(2026, 9, 16, 7), 5, 24), // 4:48/km
  run(new Date(2026, 9, 6, 7), 8, 44, 20), // settimana 5-11: 5:30/km
  run(new Date(2026, 8, 10, 7), 12, 66), // settembre
];

describe("statistiche corsa per periodo", () => {
  it("totali: km, tempo, dislivello, ritmo medio e corsa più lunga", () => {
    const t = runTotals(runs.slice(0, 2));
    expect(t).toMatchObject({ runs: 2, distance: 15_000, movingTime: 74 * 60, elevationGain: 40, longest: 10_000 });
    expect(Math.round(t.avgPace!)).toBe(296); // 4:56/km
    expect(runTotals([]).avgPace).toBeNull();
  });

  it("settimana in corso contro la scorsa: più km e ritmo più veloce", () => {
    const week = runPeriod(runs, "week", NOW, NOW);
    expect(week.current.runs).toBe(2);
    expect(week.previous?.runs).toBe(1);
    expect(week.distanceChange).toBe(88); // 15 km contro 8
    expect(week.paceChange).toBe(296 - 330); // 34 s/km più veloce
  });

  it("settimana passata e mese passato interi", () => {
    expect(runPeriod(runs, "week", new Date(2026, 9, 7), NOW).current.distance).toBe(8000);
    const september = runPeriod(runs, "month", new Date(2026, 8, 15), NOW);
    expect(september.window.isCurrent).toBe(false);
    expect(september.current.runs).toBe(1);
    expect(september.previous?.runs).toBe(0);
    expect(september.distanceChange).toBeNull();
  });

  it("mese per mese, dal più vecchio", () => {
    const months = monthlyRunTotals(runs, 3, NOW);
    expect(months.map((m) => m.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(months.map((m) => m.distance)).toEqual([0, 12_000, 23_000]);
  });

  it("settimane con l'obiettivo centrato; quella in corso conta solo se già raggiunto", () => {
    const october = periodWindow("month", NOW, NOW);
    expect(weeksOnGoal(runs, october, NOW, 10_000)).toEqual({ hit: 1, total: 3 });
    expect(weeksOnGoal(runs, october, NOW, 20_000)).toEqual({ hit: 0, total: 2 });
  });
});
