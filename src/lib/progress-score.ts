import { prisma } from "./prisma";
import { subDays } from "date-fns";
import { bestEstimatedOneRM } from "./one-rm-calculator";
import { accumulateMuscleSets, roundSets, type MuscleSetTotals } from "./muscle-volume";

/**
 * Progress Score: 0-100 rispetto allo storico dell'utente stesso.
 *
 * Ogni categoria vale 100 quando sei al tuo massimo personale; il confronto è
 * sempre e solo con te stesso, mai con altri. Le categorie senza dati
 * sufficienti vengono escluse dal calcolo: non penalizzano il punteggio e non
 * vengono inventate.
 */

const PERIOD_DAYS = 28;

/**
 * Il riferimento personale è il miglior periodo degli ultimi 6 mesi, non di
 * sempre: un record isolato di anni fa non deve tenere basso il punteggio a
 * tempo indeterminato.
 */
const REFERENCE_DAYS = 180;

export type ProgressCategoryKey = "consistency" | "strength" | "muscleVolume" | "records" | "body";

/** Peso di ogni categoria; quelle senza dati vengono escluse e i pesi rinormalizzati */
const CATEGORY_WEIGHT: Record<ProgressCategoryKey, number> = {
  strength: 0.3,
  muscleVolume: 0.3,
  records: 0.15,
  consistency: 0.15,
  body: 0.1,
};

export interface ProgressCategory {
  key: ProgressCategoryKey;
  label: string;
  /** Peso della categoria nel punteggio finale (0-1) */
  weight: number;
  /** Per la composizione corporea: quale metrica è stata usata */
  metric?: "bodyFat" | "muscleMass";
  score: number;
  previousScore: number | null;
  /** Variazione percentuale della metrica sottostante rispetto al periodo precedente */
  changePercent: number | null;
  detail: string;
}

export interface ProgressScoreResult {
  available: boolean;
  reason?: string;
  periodDays: number;
  score: number | null;
  previousScore: number | null;
  delta: number | null;
  categories: ProgressCategory[];
  insight: string | null;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** Punteggio come percentuale del proprio record personale */
const ratioScore = (current: number, best: number) =>
  best > 0 ? clampScore((current / best) * 100) : 0;

/** Variazione percentuale, solo se il riferimento è significativo */
const changePercent = (current: number, previous: number): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

/** Somma dei valori in una finestra di PERIOD_DAYS che termina in `end` */
function windowSum(points: { date: Date; value: number }[], end: number): number {
  const start = end - PERIOD_DAYS * 24 * 60 * 60 * 1000;
  return points.reduce((sum, p) => {
    const t = p.date.getTime();
    return t > start && t <= end ? sum + p.value : sum;
  }, 0);
}

/**
 * Miglior finestra di PERIOD_DAYS raggiunta nel periodo di riferimento
 * (ultimi REFERENCE_DAYS giorni), valutata alla fine di ogni giorno con dati.
 */
function bestWindow(points: { date: Date; value: number }[], since: number): number {
  let best = 0;
  for (const p of points) {
    const end = p.date.getTime();
    if (end < since) continue;
    best = Math.max(best, windowSum(points, end));
  }
  return best;
}

export async function computeProgressScore(userId: string): Promise<ProgressScoreResult> {
  const now = new Date();
  const periodStart = subDays(now, PERIOD_DAYS);
  const previousStart = subDays(now, PERIOD_DAYS * 2);
  const referenceStart = subDays(now, REFERENCE_DAYS);

  const [sessions, recentSessions, records, measurements] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED" },
      select: { startedAt: true, totalVolume: true },
      orderBy: { startedAt: "desc" },
      take: 500,
    }),
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: referenceStart } },
      select: {
        startedAt: true,
        exercises: {
          select: {
            exerciseId: true,
            exercise: { select: { primaryMuscle: true, muscleGroups: true, muscleContributions: true } },
            sets: {
              where: { type: { not: "WARMUP" } },
              select: { weight: true, reps: true, rpe: true, type: true },
            },
          },
        },
      },
    }),
    prisma.personalRecord.findMany({
      where: { userId },
      select: { exerciseId: true, recordType: true, value: true, dateAchieved: true },
      orderBy: { dateAchieved: "desc" },
      take: 500,
    }),
    prisma.bodyMeasurement.findMany({
      where: { userId },
      select: { date: true, bodyFat: true, muscleMass: true },
      orderBy: { date: "desc" },
      take: 60,
    }),
  ]);

  const base: ProgressScoreResult = {
    available: false,
    periodDays: PERIOD_DAYS,
    score: null,
    previousScore: null,
    delta: null,
    categories: [],
    insight: null,
  };

  if (sessions.length < 3) {
    return {
      ...base,
      reason:
        "Servono almeno 3 allenamenti completati per calcolare un progresso attendibile sul tuo storico.",
    };
  }

  const nowMs = now.getTime();
  const prevEndMs = periodStart.getTime();
  const referenceMs = referenceStart.getTime();
  const categories: ProgressCategory[] = [];

  // ─── Costanza ───────────────────────────────────────────────────────────────
  const sessionPoints = sessions.map((s) => ({ date: s.startedAt, value: 1 }));
  const consistencyNow = windowSum(sessionPoints, nowMs);
  const consistencyPrev = windowSum(sessionPoints, prevEndMs);
  const consistencyBest = Math.max(bestWindow(sessionPoints, referenceMs), consistencyNow);
  if (consistencyBest > 0) {
    categories.push({
      key: "consistency",
      label: "Costanza",
      weight: CATEGORY_WEIGHT.consistency,
      score: ratioScore(consistencyNow, consistencyBest),
      previousScore: ratioScore(consistencyPrev, consistencyBest),
      changePercent: changePercent(consistencyNow, consistencyPrev),
      detail: `${consistencyNow} allenamenti in ${PERIOD_DAYS} giorni (meglio degli ultimi 6 mesi: ${consistencyBest})`,
    });
  }

  // ─── Muscle Volume: serie efficaci, non tonnellaggio ───────────────────────
  const volumePoints = sessions
    .filter((s) => (s.totalVolume ?? 0) > 0)
    .map((s) => ({ date: s.startedAt, value: s.totalVolume }));
  const tonnageNow = windowSum(volumePoints, nowMs);

  // Serie efficaci per finestra: ogni sessione contribuisce con le sue serie
  const effectiveSetPoints = recentSessions.map((session) => {
    const muscles: Record<string, MuscleSetTotals> = {};
    for (const ex of session.exercises) {
      accumulateMuscleSets(muscles, ex.exercise, ex.sets);
    }
    const total = Object.values(muscles).reduce((sum, m) => sum + m.effectiveSets, 0);
    return { date: session.startedAt, value: total };
  });

  if (effectiveSetPoints.length >= 3) {
    const setsNow = windowSum(effectiveSetPoints, nowMs);
    const setsPrev = windowSum(effectiveSetPoints, prevEndMs);
    const setsBest = Math.max(bestWindow(effectiveSetPoints, referenceMs), setsNow);
    if (setsBest > 0) {
      categories.push({
        key: "muscleVolume",
        label: "Volume muscolare",
        weight: CATEGORY_WEIGHT.muscleVolume,
        score: ratioScore(setsNow, setsBest),
        previousScore: ratioScore(setsPrev, setsBest),
        changePercent: changePercent(setsNow, setsPrev),
        detail: `${roundSets(setsNow)} serie efficaci in ${PERIOD_DAYS} giorni (meglio: ${roundSets(setsBest)}) · ${Math.round(tonnageNow / 1000)}t di tonnellaggio`,
      });
    }
  }

  // ─── Forza: massimale stimato sugli esercizi principali ─────────────────────
  // Il massimale stimato usa le serie in 1-8 ripetizioni: rep range molto
  // diversi non sono confrontabili tra loro.
  const bestOneRM = (from: Date, to: Date) => {
    const map = new Map<string, number>();
    for (const session of recentSessions) {
      if (session.startedAt <= from || session.startedAt > to) continue;
      for (const ex of session.exercises) {
        const estimate = bestEstimatedOneRM(ex.sets);
        if (!estimate) continue;
        map.set(ex.exerciseId, Math.max(map.get(ex.exerciseId) ?? 0, estimate.oneRM));
      }
    }
    return map;
  };

  const currentOneRM = bestOneRM(periodStart, now);
  const previousOneRM = bestOneRM(previousStart, periodStart);

  // Riferimento personale: il miglior massimale mai registrato per esercizio
  const allTimeOneRM = new Map<string, number>();
  for (const record of records) {
    if (record.recordType !== "ONE_RM") continue;
    allTimeOneRM.set(record.exerciseId, Math.max(allTimeOneRM.get(record.exerciseId) ?? 0, record.value));
  }
  for (const [exerciseId, value] of Array.from(currentOneRM.entries())) {
    allTimeOneRM.set(exerciseId, Math.max(allTimeOneRM.get(exerciseId) ?? 0, value));
  }

  const compared = Array.from(currentOneRM.entries()).filter(([id]) => (allTimeOneRM.get(id) ?? 0) > 0);
  if (compared.length > 0) {
    const strengthScore =
      compared.reduce((sum, [id, value]) => sum + value / (allTimeOneRM.get(id) ?? value), 0) / compared.length;

    const comparablePrev = Array.from(previousOneRM.entries()).filter(([id]) => (allTimeOneRM.get(id) ?? 0) > 0);
    const previousScore = comparablePrev.length
      ? clampScore(
          (comparablePrev.reduce((sum, [id, value]) => sum + value / (allTimeOneRM.get(id) ?? value), 0) /
            comparablePrev.length) *
            100
        )
      : null;

    // Variazione media sui soli esercizi presenti in entrambi i periodi
    const shared = Array.from(currentOneRM.entries()).filter(([id]) => previousOneRM.has(id));
    const strengthChange = shared.length
      ? Math.round(
          (shared.reduce((sum, [id, value]) => sum + value / (previousOneRM.get(id) ?? value), 0) / shared.length - 1) *
            100
        )
      : null;

    categories.push({
      key: "strength",
      label: "Forza",
      weight: CATEGORY_WEIGHT.strength,
      score: clampScore(strengthScore * 100),
      previousScore,
      changePercent: strengthChange,
      detail: `Massimali stimati su ${compared.length} ${compared.length === 1 ? "esercizio" : "esercizi"} rispetto ai tuoi record`,
    });
  }

  // ─── Personal Records ───────────────────────────────────────────────────────
  if (records.length > 0) {
    const recordPoints = records.map((r) => ({ date: r.dateAchieved, value: 1 }));
    const recordsNow = windowSum(recordPoints, nowMs);
    const recordsPrev = windowSum(recordPoints, prevEndMs);
    const recordsBest = Math.max(bestWindow(recordPoints, referenceMs), recordsNow);
    if (recordsBest > 0) {
      categories.push({
        key: "records",
        label: "Record",
        weight: CATEGORY_WEIGHT.records,
        score: ratioScore(recordsNow, recordsBest),
        previousScore: ratioScore(recordsPrev, recordsBest),
        changePercent: changePercent(recordsNow, recordsPrev),
        detail: `${recordsNow} ${recordsNow === 1 ? "nuovo record" : "nuovi record"} in ${PERIOD_DAYS} giorni (massimo ${recordsBest})`,
      });
    }
  }

  // ─── Composizione corporea (solo se le misurazioni ci sono) ─────────────────
  const fatSeries = measurements.filter((m) => m.bodyFat != null);
  const muscleSeries = measurements.filter((m) => m.muscleMass != null);

  if (fatSeries.length >= 2) {
    const latest = fatSeries[0].bodyFat!;
    const beforePeriod = fatSeries.find((m) => m.date <= periodStart)?.bodyFat ?? null;
    const bestFat = Math.min(...fatSeries.map((m) => m.bodyFat!));
    categories.push({
      key: "body",
      label: "Composizione",
      weight: CATEGORY_WEIGHT.body,
      metric: "bodyFat",
      score: ratioScore(bestFat, latest),
      previousScore: beforePeriod ? ratioScore(bestFat, beforePeriod) : null,
      changePercent: beforePeriod ? changePercent(latest, beforePeriod) : null,
      detail: `Massa grassa ${latest.toFixed(1)}% (minimo storico ${bestFat.toFixed(1)}%)`,
    });
  } else if (muscleSeries.length >= 2) {
    const latest = muscleSeries[0].muscleMass!;
    const beforePeriod = muscleSeries.find((m) => m.date <= periodStart)?.muscleMass ?? null;
    const bestMuscle = Math.max(...muscleSeries.map((m) => m.muscleMass!));
    categories.push({
      key: "body",
      label: "Composizione",
      weight: CATEGORY_WEIGHT.body,
      metric: "muscleMass",
      score: ratioScore(latest, bestMuscle),
      previousScore: beforePeriod ? ratioScore(beforePeriod, bestMuscle) : null,
      changePercent: beforePeriod ? changePercent(latest, beforePeriod) : null,
      detail: `Massa muscolare ${latest.toFixed(1)} kg (massimo storico ${bestMuscle.toFixed(1)} kg)`,
    });
  }

  if (categories.length === 0) {
    return { ...base, reason: "Non ci sono ancora abbastanza dati per calcolare il punteggio." };
  }

  // Media pesata: i pesi delle categorie mancanti si redistribuiscono sulle
  // altre, così un dato assente non penalizza il punteggio.
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
  const score = clampScore(
    categories.reduce((sum, c) => sum + c.score * c.weight, 0) / (totalWeight || 1)
  );

  const withPrevious = categories.filter((c) => c.previousScore != null);
  const previousWeight = withPrevious.reduce((sum, c) => sum + c.weight, 0);
  const previousScore = withPrevious.length
    ? clampScore(
        withPrevious.reduce((sum, c) => sum + (c.previousScore ?? 0) * c.weight, 0) / (previousWeight || 1)
      )
    : null;

  return {
    available: true,
    periodDays: PERIOD_DAYS,
    score,
    previousScore,
    delta: previousScore != null ? score - previousScore : null,
    categories,
    insight: buildInsight(categories),
  };
}

/** Una sola frase, costruita sul dato più significativo realmente disponibile */
function buildInsight(categories: ProgressCategory[]): string | null {
  const withChange = categories.filter(
    (c) => c.changePercent != null && Math.abs(c.changePercent) >= 3
  );
  if (withChange.length === 0) {
    const best = [...categories].sort((a, b) => b.score - a.score)[0];
    if (best.score >= 95) return `Sei al tuo massimo personale su ${best.label.toLowerCase()}.`;
    return null;
  }

  const top = withChange.sort(
    (a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0)
  )[0];
  const change = top.changePercent ?? 0;
  const up = change > 0;
  const value = Math.abs(change);

  switch (top.key) {
    case "strength":
      return up
        ? `La tua forza è aumentata del ${value}% rispetto al periodo precedente.`
        : `I tuoi massimali sono calati del ${value}% rispetto al periodo precedente.`;
    case "muscleVolume":
      return up
        ? `Hai fatto il ${value}% di serie efficaci in più rispetto al periodo precedente.`
        : `Le serie efficaci sono calate del ${value}% rispetto al periodo precedente.`;
    case "consistency":
      return up
        ? `Ti sei allenato il ${value}% in più rispetto al periodo precedente.`
        : `Ti sei allenato il ${value}% in meno rispetto al periodo precedente.`;
    case "records":
      // Sui record contano i numeri assoluti, non le percentuali
      return up
        ? "Hai stabilito più personal record rispetto al periodo precedente."
        : "Hai stabilito meno personal record rispetto al periodo precedente.";
    case "body":
      if (top.metric === "muscleMass") {
        return up
          ? `La tua massa muscolare è cresciuta del ${value}% rispetto al periodo precedente.`
          : `La tua massa muscolare è calata del ${value}% rispetto al periodo precedente.`;
      }
      return up
        ? `La tua massa grassa è salita del ${value}% rispetto al periodo precedente.`
        : `La tua massa grassa è scesa del ${value}% rispetto al periodo precedente.`;
    default:
      return null;
  }
}
