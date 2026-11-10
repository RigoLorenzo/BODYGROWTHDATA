import { describe, expect, it } from "@jest/globals";
import { buildPlanBlocks } from "../data/plan-blocks";
import { resolvePeriod } from "../data/periods";
import { formatPace, runTrainingQuery, type SessionData, type TrainingQuery } from "../data/training-query";

const NOW = new Date("2026-11-10T18:00:00Z");

/** Campi del risultato letti dai test */
interface Result {
  value: unknown;
  directSets?: number;
  indirectSets?: number;
  weeksCounted: number;
  longestRunKm?: number;
  change?: number;
  best?: { weight: number; reps: number };
  firstInPeriod?: { value: number };
  lastInPeriod?: { value: number };
  period: { from: string; to: string; label: string };
  plans: { changedPlanInPeriod: boolean; note?: string; blocks: { plan: string; directSets?: number }[] };
  breakdown: Record<string, unknown>[];
}

const run = (data: SessionData[], q: TrainingQuery, c: Parameters<typeof runTrainingQuery>[2]) =>
  runTrainingQuery(data, q, c) as unknown as Result;

const bench = (sets: [number, number][], extra: { type?: string } = {}) => ({
  exerciseId: "bench",
  name: "Panca piana",
  primaryMuscle: "CHEST",
  muscleGroups: ["CHEST", "TRICEPS", "SHOULDERS"],
  muscleContributions: null,
  sets: sets.map(([weight, reps]) => ({ type: extra.type ?? "WORKING", weight, reps, rpe: null })),
});

const dips = (count: number) => ({
  exerciseId: "dips",
  name: "Dip",
  primaryMuscle: "TRICEPS",
  muscleGroups: ["TRICEPS", "CHEST"],
  muscleContributions: null,
  sets: Array.from({ length: count }, () => ({ type: "WORKING", weight: 0, reps: 10, rpe: null })),
});

const gym = (iso: string, exercises: SessionData["exercises"]): SessionData => ({
  id: iso,
  startedAt: new Date(`${iso}T17:00:00Z`),
  kind: "gym",
  duration: 3600,
  exercises,
  run: null,
  distance: 0,
});

const runSession = (iso: string, km: number, minutes: number): SessionData => ({
  id: `run-${iso}`,
  startedAt: new Date(`${iso}T07:00:00Z`),
  kind: "run",
  duration: minutes * 60,
  exercises: [],
  run: { distance: km * 1000, movingTime: minutes * 60 },
  distance: 0,
});

const query = (q: Partial<TrainingQuery>): TrainingQuery => ({
  metric: "sets",
  groupBy: "none",
  activity: "all",
  muscles: [],
  exerciseIds: [],
  ...q,
});

const sessions: SessionData[] = [
  gym("2026-02-02", [bench([[80, 8], [80, 8], [80, 7]]), dips(2)]),
  gym("2026-02-02", [bench([[40, 10]], { type: "WARMUP" })]),
  gym("2026-06-01", [bench([[90, 5], [90, 5]])]),
  runSession("2026-06-03", 10, 52),
  runSession("2026-06-10", 5, 25),
];

const blocks = buildPlanBlocks(
  [
    { startedAt: new Date("2026-01-05T17:00:00Z"), programId: "a", programName: "Multifrequenza 4x" },
    { startedAt: new Date("2026-05-04T17:00:00Z"), programId: "b", programName: "Upper/Lower" },
  ],
  null
);

const ctx = (preset: "this_year" | "last_n_weeks" = "this_year") => ({
  period: resolvePeriod({ preset, n: 4 }, NOW, null),
  firstActivity: new Date("2026-01-05T17:00:00Z"),
  now: NOW,
  blocks,
});

describe("runTrainingQuery: serie per muscolo", () => {
  const result = run(sessions, query({ muscles: ["CHEST"] }), ctx());

  it("conta dirette e indirette, escludendo il riscaldamento", () => {
    expect(result.directSets).toBe(5); // 3 + 2 panca
    expect(result.indirectSets).toBe(2); // dip
    expect(result.value).toBe(6); // 5 + 2 × 0,5
  });

  it("scrive il periodo interpretato", () => {
    expect(result.period).toEqual({ from: "2026-01-01", to: "2026-11-10", label: "quest'anno (2026)" });
  });

  it("segnala il cambio di piano e divide il periodo", () => {
    expect(result.plans.changedPlanInPeriod).toBe(true);
    expect(result.plans.blocks.map((b) => [b.plan, b.directSets])).toEqual([
      ["Multifrequenza 4x", 3],
      ["Upper/Lower", 2],
    ]);
    expect(result.plans.note).toMatch(/piani diversi/);
  });

  it("calcola la media settimanale dalla prima seduta", () => {
    expect(result.weeksCounted).toBeGreaterThan(43);
    expect(result.weeksCounted).toBeLessThan(45);
  });
});

describe("runTrainingQuery: altre metriche", () => {
  it("massimale stimato per esercizio con andamento", () => {
    const r = run(sessions, query({ metric: "e1rm", exerciseIds: ["bench"] }), ctx());
    expect(r.value).toBe(105); // migliore: 90 × (1 + 5/30)
    expect(r.best).toMatchObject({ weight: 90, reps: 5 });
    expect(r.firstInPeriod?.value).toBe(101.3); // 80 × (1 + 8/30)
    expect(r.lastInPeriod?.value).toBe(105); // 90 × (1 + 5/30)
    expect(r.change).toBe(3.7);
  });

  it("km di corsa, uscita più lunga e passo", () => {
    const distance = run(sessions, query({ metric: "run_distance", activity: "run" }), ctx());
    expect(distance.value).toBe(15);
    expect(distance.longestRunKm).toBe(10);
    const pace = run(sessions, query({ metric: "run_pace", activity: "run" }), ctx());
    expect(pace.value).toBe(formatPace((77 * 60) / 15));
  });

  it("sedute per tipo", () => {
    const all = run(sessions, query({ metric: "sessions" }), ctx());
    expect(all.value).toBe(5);
    const gymOnly = run(sessions, query({ metric: "sessions", activity: "gym" }), ctx());
    expect(gymOnly.value).toBe(3);
  });

  it("raggruppa per esercizio e per mese", () => {
    const byExercise = run(sessions, query({ groupBy: "exercise" }), ctx());
    expect(byExercise.breakdown[0]).toMatchObject({ exercise: "Panca piana", value: 5 });
    const byMonth = run(sessions, query({ groupBy: "month", muscles: ["CHEST"] }), ctx());
    expect(byMonth.breakdown.find((r) => r.month === "2026-02")).toMatchObject({ value: 4, plan: "Multifrequenza 4x" });
    expect(byMonth.breakdown.find((r) => r.month === "2026-03")).toMatchObject({ value: 0 });
  });

  it("ignora le sedute fuori periodo", () => {
    const r = run(sessions, query({ metric: "sessions" }), ctx("last_n_weeks"));
    expect(r.value).toBe(0);
    expect(r.plans.changedPlanInPeriod).toBe(false);
  });
});
