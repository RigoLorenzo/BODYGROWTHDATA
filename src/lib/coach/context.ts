import { prisma } from "@/lib/prisma";
import { STYLE_INFO, isTrainingStyle } from "@/lib/training-style";
import { formatDayIt, localDayKey } from "./data/periods";

const WEEKDAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

/**
 * Contesto del turno: data di oggi e situazione essenziale. Va in un messaggio
 * di sistema che il modello vede solo in questo turno (clear_at), così la
 * conversazione resta identica e la cache non si rompe.
 */
export async function turnContext(userId: string, now: Date): Promise<string> {
  const [user, active, pending] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, trainingStyle: true } }),
    prisma.activeProgram.findUnique({ where: { userId }, select: { program: { select: { name: true } } } }),
    prisma.coachProposal.count({ where: { userId, status: "pending" } }),
  ]);
  const weekday = WEEKDAYS[new Date(`${localDayKey(now)}T12:00:00Z`).getUTCDay()];
  const style = isTrainingStyle(user?.trainingStyle) ? STYLE_INFO[user.trainingStyle].name : "non scelto";
  return [
    `Oggi è ${weekday} ${formatDayIt(localDayKey(now))} (fuso Europa/Roma).`,
    `Utente: ${user?.name ?? "senza nome"}. Stile di allenamento: ${style}.`,
    `Piano attivo: ${active?.program.name ?? "nessuno"}.`,
    pending > 0 ? `Proposte di piano in attesa di essere applicate: ${pending}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
