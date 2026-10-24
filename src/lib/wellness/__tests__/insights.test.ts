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
  sleepEfficiency,
  sleepScore,
  stepsSummary,
  trendPoints,
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
    maxHr: 70,
    respRate: 14.2,
    awakeCount: 2,
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

  it("niente rapporto di carico se si riprende dopo una pausa", () => {
    // Allenamento solo negli ultimi 10 giorni: due settimane su quattro
    const comeback = Array.from({ length: 10 }, (_, i) => workout(-i, "gym"));
    expect(loadRatio(comeback, NOW)).toBeNull();
  });

  it("senza sonno né FC a riposo recenti non c'è prontezza, solo carico", () => {
    const heavy = [...Array.from({ length: 7 }, (_, i) => workout(-i, "gym")), workout(-10, "gym"), workout(-17, "gym"), workout(-24, "gym")];
    expect(loadRatio(heavy, NOW)).toBeGreaterThan(2);
    expect(readiness([night(-3)], [], heavy, NOW)).toBeNull();
    const sleepOnly = readiness([night(0)], [], heavy, NOW)!;
    expect(sleepOnly.missing).toEqual(["heart"]);
    expect(sleepOnly.score).toBeGreaterThan(50);
  });
});

describe("punteggio sonno", () => {
  it("0 senza sonno, alto con 8 ore piene e continue", () => {
    expect(sleepScore(night(0, { asleep: 0, deep: 0, light: 0, rem: 0 })).score).toBe(0);
    const full = sleepScore(night(0, { asleep: 480, deep: 100, light: 270, rem: 110, awake: 5, awakeCount: 1 }));
    expect(full.score).toBeGreaterThanOrEqual(95);
    expect(full.label).toBe("Ottimo");
  });

  it("la durata limita il totale: 3 ore perfette restano scarse", () => {
    const short = sleepScore(night(0, { asleep: 180, deep: 50, light: 80, rem: 50, awake: 0, awakeCount: 0 }));
    expect(short.score).toBeLessThanOrEqual(37);
    expect(short.label).toBe("Scarso");
  });

  it("più risvegli e meno profondo abbassano il punteggio a parità di durata", () => {
    const calm = sleepScore(night(0));
    const restless = sleepScore(night(0, { deep: 30, light: 360, rem: 60, awake: 70, awakeCount: 8 }));
    expect(restless.score).toBeLessThan(calm.score);
    expect(restless.factors.map((f) => f.key)).toEqual(["duration", "efficiency", "stages", "calm"]);
  });

  it("senza fasi né risvegli pesa solo ciò che c'è", () => {
    const bare = sleepScore(night(0, { deep: null, light: null, rem: null, awake: null, awakeCount: null }));
    expect(bare.factors.map((f) => f.key)).toEqual(["duration", "efficiency"]);
  });
});

describe("efficienza del sonno", () => {
  it("tempo addormentato sul tempo a letto, e pesa nella prontezza senza punteggio", () => {
    // 8 h a letto, 7 h 30 addormentato
    expect(sleepEfficiency(night(0))).toBeCloseTo(450 / 480, 5);
    expect(sleepEfficiency(night(0, { asleep: 0 }))).toBeNull();
    const good = readiness([night(0, { score: null })], [], [], NOW)!;
    const restless = readiness([night(0, { score: null, asleep: 300 })], [], [], NOW)!;
    expect(good.factors[0].detail).toContain("efficienza 94%");
    expect(restless.score).toBeLessThan(good.score);
  });
});

describe("andamenti", () => {
  it("giornaliero fino a 3 mesi, medie settimanali oltre", () => {
    const value = (d: string) => (d.endsWith("1") ? null : Number(d.slice(-2)));
    const daily = trendPoints(90, value, NOW);
    expect(daily).toHaveLength(90);
    expect(daily.at(-1)).toEqual({ date: day(0), value: null });

    const weekly = trendPoints(182, () => 7, NOW);
    expect(weekly).toHaveLength(26);
    expect(weekly.every((p) => p.value === 7)).toBe(true);
    expect(weekly.at(-1)!.date).toBe(day(-6));
  });

  it("la tendenza della FC a riposo guarda gli ultimi tre mesi anche con un anno di storico", () => {
    // Un anno fa 70, negli ultimi tre mesi stabile a 58
    const days = Array.from({ length: 365 }, (_, i) => emptyDay(i - 364, { restingHr: i < 275 ? 70 : 58 }));
    expect(restingTrend(days).longTerm).toBe(0);
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
