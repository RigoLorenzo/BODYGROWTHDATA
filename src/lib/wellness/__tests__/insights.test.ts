import { describe, expect, it } from "@jest/globals";
import { addDays, format } from "date-fns";
import type { ActivityItem } from "@/lib/insights";
import {
  formatMinutes,
  loadRatio,
  mainSleeps,
  readiness,
  restingTrend,
  sleepByTraining,
  sleepRoutine,
  sleepTrainingFindings,
  stepsSummary,
} from "../insights";
import type { SleepJson, WellnessDayJson } from "../types";

const NOW = new Date(2025, 9, 31, 12);
const day = (offset: number) => format(addDays(NOW, offset), "yyyy-MM-dd");

function night(offset: number, extra: Partial<SleepJson> = {}): SleepJson {
  const wake = addDays(new Date(2025, 9, 31, 7), offset);
  const bed = new Date(wake.getTime() - 8 * 3600_000);
  return {
    id: `n${offset}`,
    date: day(offset),
    startAt: bed.toISOString(),
    endAt: wake.toISOString(),
    duration: 480,
    asleep: 450,
    deep: 90,
    light: 270,
    rem: 90,
    awake: 30,
    score: 80,
    isNap: false,
    avgHr: 52,
    minHr: 46,
    stages: null,
    ...extra,
  };
}

const emptyDay = (offset: number, extra: Partial<WellnessDayJson> = {}): WellnessDayJson => ({
  date: day(offset),
  steps: null,
  distance: null,
  activeCalories: null,
  restingHr: null,
  avgHr: null,
  minHr: null,
  maxHr: null,
  hrHourly: null,
  spo2Avg: null,
  spo2Min: null,
  stressAvg: null,
  stressMax: null,
  ...extra,
});

const workout = (offset: number, kind: "gym" | "run", hour = 18): ActivityItem => ({
  id: `w${offset}${kind}`,
  startedAt: new Date(addDays(NOW, offset).setHours(hour, 0, 0, 0)),
  kind,
  duration: 3600,
  volume: 0,
  sets: 0,
  distance: 0,
  title: "x",
});

describe("sonno e allenamento", () => {
  it("una notte per giorno, la più lunga, senza pisolini", () => {
    const nights = mainSleeps([night(0, { id: "a", asleep: 200 }), night(0, { id: "b" }), night(0, { id: "nap", isNap: true, asleep: 600 })]);
    expect(nights.map((n) => n.id)).toEqual(["b"]);
  });

  it("confronta le notti dopo palestra e corsa con quelle dopo il riposo", () => {
    const sleeps: SleepJson[] = [];
    const activity: ActivityItem[] = [];
    for (let i = -20; i <= 0; i++) {
      const trainedBefore = i % 2 === 0;
      if (trainedBefore) activity.push(workout(i - 1, "gym"));
      sleeps.push(night(i, trainedBefore ? { asleep: 480, deep: 110, avgHr: 56 } : { asleep: 440, deep: 80, avgHr: 52 }));
    }
    const groups = sleepByTraining(sleeps, activity, []);
    const gym = groups.find((g) => g.key === "gym")!;
    const rest = groups.find((g) => g.key === "rest")!;
    expect(gym.nights).toBe(11);
    expect(rest.nights).toBe(10);
    expect(gym.asleep).toBe(480);

    const findings = sleepTrainingFindings(groups).map((f) => f.text);
    expect(findings).toEqual([
      "Dopo la palestra dormi 40 min in più",
      "Sonno profondo più lungo dopo la palestra (23% contro 18%)",
      "Dopo la palestra il cuore di notte batte 4 bpm più veloce: recupero in corso",
    ]);
  });

  it("orari medi a cavallo della mezzanotte e debito della settimana", () => {
    const sleeps = [-3, -2, -1, 0].map((i) => night(i, { asleep: 390 }));
    const routine = sleepRoutine(sleeps, NOW);
    expect(routine.bedtime).toBe("23:00");
    expect(routine.wake).toBe("07:00");
    expect(routine.label).toBe("Molto regolare");
    expect(routine.debt).toBe(240);
  });
});

describe("battiti e prontezza", () => {
  it("FC a riposo: norma, scarto recente e tendenza di lungo periodo", () => {
    // Due mesi a 58, poi tre giorni a 64
    const days = Array.from({ length: 60 }, (_, i) => emptyDay(i - 59, { restingHr: i < 57 ? 58 : 64 }));
    const trend = restingTrend(days);
    expect(trend.latest).toBe(64);
    expect(trend.baseline).toBe(58);
    expect(trend.delta).toBe(6);
    expect(trend.longTerm).toBeCloseTo((3 * 6) / 14, 5);
  });

  it("prontezza bassa con sonno corto e FC alta, alta con buon recupero", () => {
    const days = Array.from({ length: 40 }, (_, i) => emptyDay(i - 39, { restingHr: 55 }));
    const tired = readiness([night(0, { asleep: 300, score: 50 })], [...days.slice(0, -1), emptyDay(0, { restingHr: 63 })], [], NOW)!;
    const fresh = readiness([night(0)], days, [], NOW)!;
    expect(tired.score).toBeLessThan(55);
    expect(fresh.score).toBeGreaterThanOrEqual(75);
    expect(fresh.label).toBe("Pronto a spingere");
    expect(tired.factors.map((f) => f.key)).toEqual(["sleep", "heart"]);
  });

  it("carico acuto/cronico dai minuti di allenamento", () => {
    const activity = Array.from({ length: 28 }, (_, i) => workout(-i, "run"));
    expect(loadRatio(activity, NOW)).toBeCloseTo(1, 1);
    expect(loadRatio([], NOW)).toBeNull();
  });
});

describe("passi", () => {
  it("medie, giorni a obiettivo e giorno migliore", () => {
    const days = Array.from({ length: 30 }, (_, i) => emptyDay(i - 29, { steps: i % 3 === 0 ? 12_000 : 6_000 }));
    const s = stepsSummary(days, NOW);
    expect(s.today).toBe(6_000);
    expect(s.goalDays30).toBe(10);
    expect(s.avg30).toBe(8_000);
    expect(s.best?.steps).toBe(12_000);
    expect(formatMinutes(452)).toBe("7h 32m");
    expect(formatMinutes(45)).toBe("45 min");
  });
});
