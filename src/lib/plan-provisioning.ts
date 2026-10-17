import type { Prisma, PrismaClient } from "@prisma/client";
import type { PlanDefinition } from "./plans/types";
import type { ProgramInput } from "./program-schema";
import { createProgram, updateProgram } from "./program-writer";
import { multifrequenza4x } from "./plans/multifrequenza-4x";

/**
 * Schede da caricare e attivare al deploy, una sola volta per chiave.
 * Se l'utente ha già una scheda con lo stesso nome viene aggiornata sul posto
 * (stessi giorni, così lo storico resta collegato), altrimenti viene creata.
 * Dopo l'applicazione è un piano come gli altri: si può modificare, disattivare
 * o sostituire dall'app e i deploy successivi non la ripristinano.
 * Per caricare una nuova versione basta cambiare la chiave.
 */
interface PlanProvision {
  key: string;
  ownerEmail: string;
  plan: PlanDefinition;
}

const provisions: PlanProvision[] = [
  {
    key: "plan:multifrequenza-4x:v2",
    ownerEmail: "lorenzo.rigo.vr02@gmail.com",
    plan: multifrequenza4x,
  },
];

type ProvisionResult = "created" | "updated" | "already-applied" | "owner-missing";
type Tx = Prisma.TransactionClient;

async function resolveExerciseIds(
  client: PrismaClient,
  plan: PlanDefinition
): Promise<Map<string, string>> {
  const names = Array.from(new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.name))));
  const rows = await client.exercise.findMany({
    where: { name: { in: names }, isCustom: false, isPublic: true },
    select: { id: true, name: true },
  });
  const ids = new Map(rows.map((r) => [r.name, r.id]));
  const missing = names.filter((n) => !ids.has(n));
  if (missing.length > 0) {
    throw new Error(`Esercizi assenti dalla libreria: ${missing.join(", ")}`);
  }
  return ids;
}

/** Definizione per nome → input del writer, con gli id della libreria */
function toProgramInput(plan: PlanDefinition, ids: Map<string, string>, dayIds: (string | undefined)[] = []): ProgramInput {
  return {
    name: plan.name,
    description: plan.description,
    frequency: plan.frequency,
    durationWeeks: plan.durationWeeks,
    splitType: plan.splitType,
    days: plan.days.map((day, dayIndex) => ({
      id: dayIds[dayIndex],
      name: day.name,
      workoutType: day.workoutType,
      exercises: day.exercises.map(({ name, ...fields }) => ({ exerciseId: ids.get(name)!, ...fields })),
    })),
  };
}

/** La scheda diventa quella attuale; se lo era già, il progresso resta dov'è */
async function activate(tx: Tx, ownerId: string, programId: string) {
  const current = await tx.activeProgram.findUnique({ where: { userId: ownerId } });
  if (current?.programId === programId) return;
  await tx.activeProgram.upsert({
    where: { userId: ownerId },
    update: { programId, currentDay: 0, currentWeek: 1, startedAt: new Date(), completedAt: null },
    create: { userId: ownerId, programId },
  });
}

async function applyProvision(
  client: PrismaClient,
  { key, ownerEmail, plan }: PlanProvision
): Promise<ProvisionResult> {
  const done = await client.dataProvision.findUnique({ where: { key } });
  if (done) return "already-applied";

  // Utente non ancora registrato: niente marcatore, si riprova al prossimo deploy.
  const owner = await client.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) return "owner-missing";

  const ids = await resolveExerciseIds(client, plan);

  return client.$transaction(async (tx) => {
    const existing = await tx.program.findFirst({
      where: { creatorId: owner.id, name: plan.name },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    let programId: string;
    if (existing) {
      // Stessa posizione = stesso giorno: lo storico resta collegato
      const days = await tx.programDay.findMany({
        where: { programId: existing.id },
        orderBy: { dayIndex: "asc" },
        select: { id: true },
      });
      await updateProgram(tx, existing.id, toProgramInput(plan, ids, days.map((d) => d.id)));
      programId = existing.id;
    } else {
      programId = (await createProgram(tx, owner.id, toProgramInput(plan, ids))).id;
    }

    await activate(tx, owner.id, programId);
    await tx.dataProvision.create({ data: { key } });
    return existing ? "updated" : "created";
  }, { timeout: 30_000 });
}

export async function provisionPlans(client: PrismaClient): Promise<void> {
  for (const provision of provisions) {
    const result = await applyProvision(client, provision);
    console.log(`📋 ${provision.key}: ${result}`);
  }
}
