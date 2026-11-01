import type { PrismaClient } from "@prisma/client";

/**
 * Una tantum al deploy (stesso registro delle schede e del benessere): fino
 * a ora si importavano solo le corse. Azzerando l'ultima sincronizzazione,
 * la prossima rilegge l'ultimo anno di attività di Garmin e Mi Fitness e
 * aggiunge palestra, bici e il resto. Le corse già importate si aggiornano
 * senza doppioni (stesso id di origine).
 */
const REIMPORT_KEY = "activities:reimport:v1-all-sports";

export async function provisionActivities(client: PrismaClient) {
  const done = await client.dataProvision.findUnique({ where: { key: REIMPORT_KEY } });
  if (done) return "already-applied";
  await client.$transaction([
    client.garminConnection.updateMany({ data: { lastSyncAt: null } }),
    client.miFitnessConnection.updateMany({ data: { lastSyncAt: null } }),
    client.dataProvision.create({ data: { key: REIMPORT_KEY } }),
  ]);
  return "applied";
}
