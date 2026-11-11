/**
 * Obiettivo settimanale: quante sedute e/o quanti km a settimana, e quante
 * settimane di fila l'hai raggiunto. Funzioni pure, testate.
 *
 * - Bodybuilding e powerlifting: sedute (in palestra).
 * - Corsa: km; le sedute, se le imposti, contano anche le corse.
 * - Ibrido: sedute (palestra + corsa) e km.
 * Senza un obiettivo scelto, le sedute sono la frequenza del piano attivo.
 */

export type GoalStyle = "BODYBUILDING" | "POWERLIFTING" | "RUNNING" | "HYBRID" | null;

export interface WeeklyGoals {
  sessions: number | null;
  km: number | null;
  /** le corse contano come sedute (Corsa, Ibrido) */
  runsCount: boolean;
}

export interface WeekTotals {
  /** inizio settimana, yyyy-MM-dd */
  week: string;
  gymSessions: number;
  runs: number;
  /** km di corsa */
  km: number;
}

export interface GoalItem {
  kind: "sessions" | "km";
  done: number;
  target: number;
  ratio: number;
  reached: boolean;
}

export function goalsFor(
  style: GoalStyle,
  profile: { weeklySessionsGoal?: number | null; weeklyRunKmGoal?: number | null } | null,
  planFrequency: number | null
): WeeklyGoals {
  const runsCount = style === "RUNNING" || style === "HYBRID";
  const sessions = profile?.weeklySessionsGoal ?? (style === "RUNNING" ? null : planFrequency) ?? null;
  const km = runsCount && profile?.weeklyRunKmGoal ? profile.weeklyRunKmGoal : null;
  return { sessions: sessions && sessions > 0 ? sessions : null, km, runsCount };
}

export const hasGoals = (goals: WeeklyGoals) => goals.sessions != null || goals.km != null;

export function sessionsDone(week: Pick<WeekTotals, "gymSessions" | "runs">, goals: Pick<WeeklyGoals, "runsCount">) {
  return week.gymSessions + (goals.runsCount ? week.runs : 0);
}

/** Avanzamento della settimana verso ciascun obiettivo */
export function weekProgress(week: WeekTotals, goals: WeeklyGoals): { items: GoalItem[]; reached: boolean } {
  const items: GoalItem[] = [];
  if (goals.sessions != null) {
    const done = sessionsDone(week, goals);
    items.push({ kind: "sessions", done, target: goals.sessions, ratio: Math.min(1, done / goals.sessions), reached: done >= goals.sessions });
  }
  if (goals.km != null) {
    const done = Math.round(week.km * 10) / 10;
    items.push({ kind: "km", done, target: goals.km, ratio: Math.min(1, week.km / goals.km), reached: week.km >= goals.km });
  }
  return { items, reached: items.length > 0 && items.every((i) => i.reached) };
}

/**
 * Settimane di fila con l'obiettivo raggiunto. `weeks` in ordine cronologico,
 * l'ultima è quella in corso: conta se è già raggiunta, altrimenti non rompe
 * la serie (la settimana non è finita). Si usa l'obiettivo di oggi anche per
 * le settimane passate.
 */
export function weeksInARow(weeks: WeekTotals[], goals: WeeklyGoals): number {
  if (!hasGoals(goals) || weeks.length === 0) return 0;
  const current = weeks[weeks.length - 1];
  let count = weekProgress(current, goals).reached ? 1 : 0;
  for (let i = weeks.length - 2; i >= 0; i--) {
    if (!weekProgress(weeks[i], goals).reached) break;
    count++;
  }
  return count;
}

/** Obiettivo di sedute suggerito: la media delle ultime settimane attive, tra 1 e 7 */
export function suggestSessionsGoal(sessionsPerWeek: number[]): number {
  const active = sessionsPerWeek.slice(-8).filter((n) => n > 0);
  if (active.length === 0) return 3;
  const avg = active.reduce((s, n) => s + n, 0) / active.length;
  return Math.min(7, Math.max(1, Math.round(avg)));
}

/** "2 di 4 sedute", "18,5 di 25 km" */
export function goalText(item: GoalItem): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
  return item.kind === "sessions"
    ? `${item.done} di ${item.target} ${item.target === 1 ? "seduta" : "sedute"}`
    : `${fmt(item.done)} di ${fmt(item.target)} km`;
}

/** Obiettivo della settimana in corso, come lo restituisce il server */
export interface WeeklyGoalSummary {
  style: GoalStyle;
  /** obiettivi in vigore (scelti o dal piano) */
  sessions: number | null;
  km: number | null;
  runsCount: boolean;
  /** cosa ha scelto l'utente (null = automatico) */
  chosen: { sessions: number | null; km: number | null };
  planFrequency: number | null;
  items: GoalItem[];
  reached: boolean;
  weeksInARow: number;
  suggestedSessions: number;
}
