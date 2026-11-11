import { format, startOfWeek, subWeeks } from "date-fns";
import { prisma } from "./prisma";
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

const weekKey = (d: Date) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");

/** Obiettivo della settimana in corso, con avanzamento e settimane di fila */
export async function weeklyGoalSummary(userId: string, now: Date = new Date()): Promise<WeeklyGoalSummary> {
  const from = startOfWeek(subWeeks(now, HISTORY_WEEKS - 1), { weekStartsOn: 1 });
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
    const key = weekKey(subWeeks(now, i));
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
    suggestedSessions: suggestSessionsGoal(history.slice(0, -1).map((w) => w.gymSessions + (goals.runsCount ? w.runs : 0))),
  };
}
