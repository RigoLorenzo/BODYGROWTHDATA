import type { PrismaClient } from "@prisma/client";

/**
 * Interventi una tantum sui dati benessere al deploy (stesso registro delle
 * schede). v2: la prima sincronizzazione troncava i battiti e poteva perdere
 * blocchi interi; si riparte da capo per riscaricare tutto lo storico. I dati
 * già salvati restano e vengono sovrascritti con quelli completi.
 */
const RESYNC_KEY = "wellness:resync:v2";

export async function provisionWellness(client: PrismaClient) {
  const done = await client.dataProvision.findUnique({ where: { key: RESYNC_KEY } });
  if (done) return "already-applied";
  await client.$transaction([
    client.miFitnessConnection.updateMany({
      data: { wellnessSyncedFrom: null, wellnessSyncedUntil: null, wellnessHrFrom: null, wellnessHrUntil: null },
    }),
    client.dataProvision.create({ data: { key: RESYNC_KEY } }),
  ]);
  return "applied";
}
