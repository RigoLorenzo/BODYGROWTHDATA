import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { STYLE_INFO, isTrainingStyle } from "@/lib/training-style";
import { calculateOneRM } from "@/lib/one-rm-calculator";
import { formatDayIt, localDayKey } from "../data/periods";
import { loadPlanBlocks } from "../data/repository";
import { missingBriefSlots } from "../proposal-checks";

/** Tool di lettura del profilo, del piano, dello storico di un esercizio e del recupero */

const ageFrom = (birthDate: Date | null, now: Date) =>
  birthDate ? Math.floor((now.getTime() - birthDate.getTime()) / (365.25 * 86_400_000)) : null;

const day = (date: Date) => formatDayIt(localDayKey(date));

export async function athleteOverview(userId: string, now: Date) {
  const since = subDays(now, 28);
  const [user, goals, brief, active, recent, measurement, records, blocks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        trainingStyle: true,
        wellnessSource: true,
        profile: {
          select: { weight: true, height: true, birthDate: true, experienceLevel: true, weeklyRunKmGoal: true, maxHeartRate: true, restingHeartRate: true },
        },
      },
    }),
    prisma.goal.findMany({ where: { userId, achieved: false }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.athleteBrief.findUnique({ where: { userId } }),
    prisma.activeProgram.findUnique({
      where: { userId },
      select: {
        startedAt: true,
        currentDay: true,
        program: { select: { id: true, name: true, frequency: true, durationWeeks: true, splitType: true, _count: { select: { days: true } } } },
      },
    }),
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: since } },
      select: { startedAt: true, workoutType: true, sportType: true, run: { select: { distance: true } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.bodyMeasurement.findFirst({ where: { userId }, orderBy: { date: "desc" }, select: { date: true, weight: true, bodyFat: true } }),
    prisma.personalRecord.findMany({
      where: { userId, dateAchieved: { gte: subDays(now, 60) } },
      orderBy: { dateAchieved: "desc" },
      take: 5,
      select: { dateAchieved: true, recordType: true, value: true, weight: true, reps: true, exercise: { select: { name: true, nameIt: true } } },
    }),
    loadPlanBlocks(userId),
  ]);

  const style = isTrainingStyle(user?.trainingStyle) ? STYLE_INFO[user.trainingStyle] : null;
  const runs = recent.filter((s) => s.run);
  return {
    today: day(now),
    name: user?.name ?? null,
    trainingStyle: style ? { value: style.value, name: style.name, goal: style.goal } : null,
    profile: user?.profile
      ? {
          weightKg: user.profile.weight,
          heightCm: user.profile.height,
          age: ageFrom(user.profile.birthDate, now),
          experienceLevel: user.profile.experienceLevel,
          weeklyRunKmGoal: user.profile.weeklyRunKmGoal,
        }
      : null,
    latestBodyMeasurement: measurement ? { day: day(measurement.date), weightKg: measurement.weight, bodyFat: measurement.bodyFat } : null,
    goals: goals.map((g) => ({
      targetBodyWeight: g.targetBodyWeight,
      weeklyFrequency: g.weeklyFrequency,
      targetLift: g.targetLift,
      targetLiftWeight: g.targetLiftWeight,
      deadline: g.deadline ? day(g.deadline) : null,
    })),
    athleteBrief: brief
      ? {
          primaryGoal: brief.primaryGoal,
          goalDetails: brief.goalDetails,
          daysPerWeek: brief.daysPerWeek,
          preferredDays: brief.preferredDays,
          sessionMinutes: brief.sessionMinutes,
          equipment: brief.equipment,
          likedExerciseIds: brief.likedExerciseIds,
          dislikedExerciseIds: brief.dislikedExerciseIds,
          injuries: brief.injuries,
          notes: brief.notes,
        }
      : null,
    missingForNewPlan: missingBriefSlots(brief),
    activeProgram: active
      ? {
          id: active.program.id,
          name: active.program.name,
          daysInPlan: active.program._count.days,
          frequencyPerWeek: active.program.frequency,
          durationWeeks: active.program.durationWeeks,
          splitType: active.program.splitType,
          activeSince: day(active.startedAt),
          workoutsDoneOnPlan: active.currentDay,
        }
      : null,
    planHistory: blocks.map((b) => ({ plan: b.name, from: day(b.from), to: b.to ? day(new Date(b.to.getTime() - 1)) : "oggi", current: b.current })),
    last4Weeks: {
      workouts: recent.length,
      gym: recent.length - runs.length,
      runs: runs.length,
      runKm: Math.round(runs.reduce((s, r) => s + (r.run?.distance ?? 0), 0) / 100) / 10,
      lastWorkout: recent[0] ? day(recent[0].startedAt) : null,
    },
    recentRecords: records.map((r) => ({
      day: day(r.dateAchieved),
      exercise: r.exercise.nameIt ?? r.exercise.name,
      type: r.recordType,
      value: r.value,
      weight: r.weight,
      reps: r.reps,
    })),
    wellnessConnected: Boolean(user?.wellnessSource),
  };
}

export async function programDetail(userId: string, programId?: string) {
  const id =
    programId ?? (await prisma.activeProgram.findUnique({ where: { userId }, select: { programId: true } }))?.programId;
  if (!id) return { error: "Nessun piano attivo. Puoi proporne uno nuovo con propose_program." };

  const program = await prisma.program.findFirst({
    where: { id, creatorId: userId },
    include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!program) return { error: "Piano non trovato." };

  const exerciseIds = program.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, name: true, nameIt: true, primaryMuscle: true },
  });
  const byId = new Map(exercises.map((e) => [e.id, e]));

  return {
    id: program.id,
    name: program.name,
    description: program.description,
    frequencyPerWeek: program.frequency,
    durationWeeks: program.durationWeeks,
    splitType: program.splitType,
    days: program.days.map((d) => ({
      name: d.name,
      workoutType: d.workoutType,
      exercises: d.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        name: byId.get(e.exerciseId)?.nameIt ?? byId.get(e.exerciseId)?.name ?? "Esercizio",
        primaryMuscle: byId.get(e.exerciseId)?.primaryMuscle ?? null,
        sets: e.sets,
        reps: e.repsMin === e.repsMax ? `${e.repsMin}` : `${e.repsMin}-${e.repsMax}`,
        rpe: e.rpe,
        restSeconds: e.restSeconds,
        notes: e.notes,
      })),
    })),
  };
}

export async function exerciseHistory(userId: string, exerciseId: string, lastSessions: number) {
  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ isPublic: true }, { createdById: userId }, { isCustom: false }] },
    select: { name: true, nameIt: true },
  });
  if (!exercise) return { error: "Esercizio non trovato. Usa search_exercises per l'id." };

  const rows = await prisma.workoutExercise.findMany({
    where: { exerciseId, session: { userId, status: "COMPLETED" } },
    orderBy: { session: { startedAt: "desc" } },
    take: lastSessions,
    select: {
      session: { select: { startedAt: true } },
      sets: { orderBy: { setNumber: "asc" }, select: { type: true, weight: true, reps: true, rpe: true } },
    },
  });

  return {
    exercise: exercise.nameIt ?? exercise.name,
    sessions: rows.map((r) => {
      const working = r.sets.filter((s) => s.type !== "WARMUP");
      const best = working.reduce((max, s) => (s.weight && s.reps ? Math.max(max, calculateOneRM(s.weight, s.reps)) : max), 0);
      return {
        day: day(r.session.startedAt),
        sets: working.map((s) => `${s.weight ?? 0}kg×${s.reps ?? 0}${s.rpe ? ` @RPE ${s.rpe}` : ""}`),
        warmupSets: r.sets.length - working.length,
        bestE1rm: best ? Math.round(best * 10) / 10 : null,
      };
    }),
  };
}

const avg = (values: (number | null | undefined)[]) => {
  const list = values.filter((v): v is number => typeof v === "number");
  return list.length ? Math.round((list.reduce((s, v) => s + v, 0) / list.length) * 10) / 10 : null;
};

export async function recoverySummary(userId: string, days: number, now: Date) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { wellnessSource: true } });
  if (!user?.wellnessSource) return { error: "Nessun orologio collegato per sonno e battito." };

  const fromDay = localDayKey(subDays(now, days));
  const [wellness, sleep] = await Promise.all([
    prisma.wellnessDay.findMany({
      where: { userId, source: user.wellnessSource, date: { gte: fromDay } },
      orderBy: { date: "asc" },
      select: { date: true, steps: true, restingHr: true, stressAvg: true, spo2Avg: true },
    }),
    prisma.sleepSession.findMany({
      where: { userId, source: user.wellnessSource, isNap: false, date: { gte: fromDay } },
      orderBy: { date: "asc" },
      select: { date: true, asleep: true, deep: true, rem: true, score: true },
    }),
  ]);

  const half = <T,>(list: T[]) => [list.slice(0, Math.floor(list.length / 2)), list.slice(Math.floor(list.length / 2))];
  const [hrEarly, hrLate] = half(wellness);
  return {
    days,
    source: user.wellnessSource,
    restingHr: { average: avg(wellness.map((w) => w.restingHr)), firstHalf: avg(hrEarly.map((w) => w.restingHr)), secondHalf: avg(hrLate.map((w) => w.restingHr)) },
    stressAverage: avg(wellness.map((w) => w.stressAvg)),
    stepsAverage: avg(wellness.map((w) => w.steps)),
    sleep: {
      nights: sleep.length,
      averageAsleepMinutes: avg(sleep.map((s) => s.asleep)),
      averageDeepMinutes: avg(sleep.map((s) => s.deep)),
      averageRemMinutes: avg(sleep.map((s) => s.rem)),
      averageScore: avg(sleep.map((s) => s.score)),
    },
    lastDays: wellness.slice(-3).map((w) => ({
      day: formatDayIt(w.date),
      restingHr: w.restingHr,
      stress: w.stressAvg,
      sleepMinutes: sleep.find((s) => s.date === w.date)?.asleep ?? null,
    })),
  };
}
