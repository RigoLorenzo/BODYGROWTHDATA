import type { PrismaClient } from "@prisma/client";
import type { PlanDefinition } from "./plans/types";
import { multifrequenza4x } from "./plans/multifrequenza-4x";

/**
 * Schede da caricare e attivare al deploy, una sola volta per chiave.
 * Dopo l'applicazione la scheda è un piano come gli altri: si può modificare,
 * disattivare o sostituire dall'app e i deploy successivi non la ripristinano.
 */
interface PlanProvision {
  key: string;
  ownerEmail: string;
  plan: PlanDefinition;
}

const provisions: PlanProvision[] = [
  {
    key: "plan:multifrequenza-4x:v1",
    ownerEmail: "lorenzo.rigo.vr02@gmail.com",
    plan: multifrequenza4x,
  },
];

type ProvisionResult = "applied" | "already-applied" | "owner-missing";

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

function buildDays(plan: PlanDefinition, ids: Map<string, string>) {
  return plan.days.map((day, dayIndex) => ({
    dayIndex,
    name: day.name,
    workoutType: day.workoutType,
    exercises: {
      create: day.exercises.map(({ name, ...fields }, orderIndex) => ({
        exerciseId: ids.get(name)!,
        orderIndex,
        ...fields,
      })),
    },
  }));
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

  await client.$transaction(async (tx) => {
    const program = await tx.program.create({
      data: {
        name: plan.name,
        description: plan.description,
        frequency: plan.frequency,
        durationWeeks: plan.durationWeeks,
        splitType: plan.splitType,
        creatorId: owner.id,
        days: { create: buildDays(plan, ids) },
      },
    });

    // Stessa semantica di POST /api/programs/active: il nuovo piano diventa
    // quello attuale e riparte dal primo giorno.
    await tx.activeProgram.upsert({
      where: { userId: owner.id },
      update: { programId: program.id, currentDay: 0, currentWeek: 1, startedAt: new Date(), completedAt: null },
      create: { userId: owner.id, programId: program.id },
    });

    await tx.dataProvision.create({ data: { key } });
  });

  return "applied";
}

export async function provisionPlans(client: PrismaClient): Promise<void> {
  for (const provision of provisions) {
    const result = await applyProvision(client, provision);
    console.log(`📋 ${provision.key}: ${result}`);
  }
}
