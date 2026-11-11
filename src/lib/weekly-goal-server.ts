import { prisma } from "./prisma";
import { localMidnight, weekKey } from "./coach/data/periods";
import { isTrainingStyle } from "./training-style";
import {
  goalsFor,
  hasGoals,
  suggestSessionsGoal,
  weekProgress,
  weeksInARow,
  type WeekTotals,
  type WeeklyGoalSummary,
} from "./weekly-goal";

export type { WeeklyGoalSummary } from "./weekly-goal";

/** Settimane lette per la serie di settimane raggiunte */
const HISTORY_WEEKS = 26;

/** Lunedì "yyyy-MM-dd" spostato di n settimane (aritmetica di calendario, senza fuso) */
function shiftWeek(key: string, weeks: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + weeks * 7)).toISOString().slice(0, 10);
}

/** Mezzanotte di Roma del lunedì indicato */
function weekStart(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return localMidnight({ year, month, day });
}

/** Obiettivo della settimana in corso, con avanzamento e settimane di fila */
// Settimane da lunedì a domenica nel fuso di Roma: il server gira in UTC
export async function weeklyGoalSummary(userId: string, now: Date = new Date()): Promise<WeeklyGoalSummary> {
  const currentWeek = weekKey(now);
  const from = weekStart(shiftWeek(currentWeek, -(HISTORY_WEEKS - 1)));
  const [user, active, sessions, runs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { trainingStyle: true, profile: { select: { weeklySessionsGoal: true, weeklyRunKmGoal: true } } },
    }),
    prisma.activeProgram.findUnique({ where: { userId }, select: { program: { select: { frequency: true } } } }),
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: from }, workoutType: { not: "CARDIO" } },
      select: { startedAt: true },
    }),
    prisma.runActivity.findMany({ where: { userId, startedAt: { gte: from } }, select: { startedAt: true, distance: true } }),
  ]);

  // Una riga per settimana, anche quelle vuote (contano per la serie)
  const weeks = new Map<string, WeekTotals>();
  for (let i = HISTORY_WEEKS - 1; i >= 0; i--) {
    const key = shiftWeek(currentWeek, -i);
    weeks.set(key, { week: key, gymSessions: 0, runs: 0, km: 0 });
  }
  for (const s of sessions) {
    const w = weeks.get(weekKey(s.startedAt));
    if (w) w.gymSessions++;
  }
  for (const r of runs) {
    const w = weeks.get(weekKey(r.startedAt));
    if (w) {
      w.runs++;
      w.km += r.distance / 1000;
    }
  }

  const style = isTrainingStyle(user?.trainingStyle) ? user.trainingStyle : null;
  const planFrequency = active?.program.frequency ?? null;
  const goals = goalsFor(style, user?.profile ?? null, planFrequency);
  const history = Array.from(weeks.values());
  const current = history[history.length - 1];
  const progress = weekProgress(current, goals);
  const pastSessions = history.slice(0, -1).map((w) => w.gymSessions + (goals.runsCount ? w.runs : 0));

  return {
    style,
    sessions: goals.sessions,
    km: goals.km,
    runsCount: goals.runsCount,
    chosen: { sessions: user?.profile?.weeklySessionsGoal ?? null, km: user?.profile?.weeklyRunKmGoal ?? null },
    planFrequency,
    items: progress.items,
    reached: progress.reached,
    weeksInARow: hasGoals(goals) ? weeksInARow(history, goals) : 0,
    suggestedSessions: suggestSessionsGoal(pastSessions),
    suggestionFromHistory: pastSessions.some((n) => n > 0),
  };
}
