import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Interventi una tantum sui dati benessere al deploy (stesso registro delle
 * schede). v2: la prima sincronizzazione troncava i battiti e poteva perdere
 * blocchi interi; si riparte da capo per riscaricare tutto lo storico. I dati
 * già salvati restano e vengono sovrascritti con quelli completi.
 */
const RESYNC_KEY = "wellness:resync:v2";

/** v3: le notti hanno respirazione, risvegli e FC massima; si riscarica solo il binario leggero */
const RESYNC_LIGHT_KEY = "wellness:resync:v3-light";

/**
 * v4: sonno e FC a riposo anche dai riepiloghi giornalieri. Dal 20/10/2026
 * i dati grezzi non arrivano più: si rileggono le ultime due settimane.
 */
const RESYNC_RECENT_KEY = "wellness:resync:v4-daily-report";
const RESYNC_RECENT_DAYS = 14;

type ConnectionUpdate = Prisma.MiFitnessConnectionUpdateManyArgs;

async function applyOnce(client: PrismaClient, key: string, data: ConnectionUpdate["data"], where?: ConnectionUpdate["where"]) {
  const done = await client.dataProvision.findUnique({ where: { key } });
  if (done) return "already-applied";
  await client.$transaction([
    client.miFitnessConnection.updateMany({ data, where }),
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
  // Solo il cursore in avanti: lo storico già scaricato resta
  const recent = new Date(Date.now() - RESYNC_RECENT_DAYS * 86_400_000);
  const v4 = await applyOnce(client, RESYNC_RECENT_KEY, { wellnessSyncedUntil: recent }, { wellnessSyncedUntil: { gt: recent } });
  return `v2 ${v2}, v3 ${v3}, v4 ${v4}`;
}
