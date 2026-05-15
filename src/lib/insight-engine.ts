import { prisma } from "./prisma";
import { subWeeks, subDays } from "date-fns";
import { calculateOneRM } from "./one-rm-calculator";

export interface Insight {
  type: "plateau" | "overtraining" | "undertraining" | "pr_prediction" | "deload" | "volume_imbalance";
  severity: "info" | "warning" | "success";
  title: string;
  body: string;
  exerciseId?: string;
  exerciseName?: string;
  actionLabel?: string;
}

export async function generateInsights(userId: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();

  const [recentSessions, streak] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: subWeeks(now, 4) } },
      include: {
        exercises: {
          include: {
            sets: { where: { type: { not: "WARMUP" } } },
            exercise: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.streak.findUnique({ where: { userId } }),
  ]);

  // Plateau detection
  const exerciseProgress = new Map<string, { dates: Date[]; weights: number[]; name: string }>();
  for (const session of recentSessions) {
    for (const ex of session.exercises) {
      const workingSets = ex.sets.filter((s) => s.type === "WORKING" && s.weight && s.reps);
      if (!workingSets.length) continue;
      const maxWeight = Math.max(...workingSets.map((s) => s.weight ?? 0));
      if (!exerciseProgress.has(ex.exerciseId)) {
        exerciseProgress.set(ex.exerciseId, { dates: [], weights: [], name: ex.exercise.name });
      }
      const data = exerciseProgress.get(ex.exerciseId)!;
      data.dates.push(session.startedAt);
      data.weights.push(maxWeight);
    }
  }

  for (const [exerciseId, data] of exerciseProgress.entries()) {
    if (data.weights.length >= 3) {
      const recent = data.weights.slice(0, 3);
      const maxRecent = Math.max(...recent);
      const minRecent = Math.min(...recent);
      if ((maxRecent - minRecent) / maxRecent < 0.03) {
        insights.push({
          type: "plateau",
          severity: "warning",
          title: `Plateau su ${data.name}`,
          body: `Nessun progresso significativo nelle ultime ${data.weights.length} sessioni. Considera: deload del 10% + cambio rep range o variante dell'esercizio.`,
          exerciseId,
          exerciseName: data.name,
          actionLabel: "Vedi esercizi alternativi",
        });
      }
    }
  }

  // High RPE warning (overtraining signal)
  const last5Sessions = recentSessions.slice(0, 5);
  if (last5Sessions.length >= 3) {
    const avgRPE = last5Sessions.reduce((sum, s) => sum + (s.rpe ?? 7), 0) / last5Sessions.length;
    if (avgRPE >= 8.5) {
      insights.push({
        type: "overtraining",
        severity: "warning",
        title: "Intensità molto elevata",
        body: `RPE medio delle ultime ${last5Sessions.length} sessioni: ${avgRPE.toFixed(1)}. Considera una sessione di recupero attivo o un deload.`,
        actionLabel: "Pianifica deload",
      });
    }
  }

  // Undertraining (streak broken)
  if (streak && streak.currentStreak === 0 && streak.totalWorkouts > 0) {
    insights.push({
      type: "undertraining",
      severity: "info",
      title: "Torna in sala!",
      body: `La tua streak si è interrotta. Ogni grande atleta ha avuto pause — l'importante è riprendere. Inizia subito un allenamento leggero!`,
      actionLabel: "Inizia allenamento",
    });
  }

  return insights.slice(0, 3);
}
