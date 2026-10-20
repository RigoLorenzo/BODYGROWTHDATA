import type { PrismaClient } from "@prisma/client";

/**
 * Interventi una tantum sui dati benessere al deploy (stesso registro delle
 * schede). v2: la prima sincronizzazione troncava i battiti e poteva perdere
 * blocchi interi; si riparte da capo per riscaricare tutto lo storico. I dati
 * già salvati restano e vengono sovrascritti con quelli completi.
 */
const RESYNC_KEY = "wellness:resync:v2";

/** v3: le notti hanno respirazione, risvegli e FC massima; si riscarica solo il binario leggero */
const RESYNC_LIGHT_KEY = "wellness:resync:v3-light";

async function applyOnce(client: PrismaClient, key: string, data: Record<string, null>) {
  const done = await client.dataProvision.findUnique({ where: { key } });
  if (done) return "already-applied";
  await client.$transaction([
    client.miFitnessConnection.updateMany({ data }),
    client.dataProvision.create({ data: { key } }),
  ]);
  return "applied";
}

export async function provisionWellness(client: PrismaClient) {
  const v2 = await applyOnce(client, RESYNC_KEY, {
    wellnessSyncedFrom: null,
    wellnessSyncedUntil: null,
    wellnessHrFrom: null,
    wellnessHrUntil: null,
  });
  const v3 = await applyOnce(client, RESYNC_LIGHT_KEY, { wellnessSyncedFrom: null, wellnessSyncedUntil: null });
  return `v2 ${v2}, v3 ${v3}`;
}
