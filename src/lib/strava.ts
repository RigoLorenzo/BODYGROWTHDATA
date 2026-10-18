import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { saveRun, type RunInput } from "@/lib/run/repository";
import type { BestEffort, RunSplit } from "@/lib/run/track";
import { updateUserStreak } from "@/lib/streak-calculator";

/**
 * Integrazione con l'API ufficiale di Strava.
 * Variabili d'ambiente: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET,
 * STRAVA_WEBHOOK_VERIFY_TOKEN (stringa a piacere per il webhook).
 */

const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";
export const STRAVA_SCOPE = "read,activity:read_all";

/** Tipi di attività importati come corsa */
export const RUN_SPORT_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export class StravaError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "StravaError";
  }
}

export function stravaConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const cfg = stravaConfig();
  if (!cfg) throw new StravaError("Strava non configurato");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  });
  return `${OAUTH}/authorize?${params}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const cfg = stravaConfig();
  if (!cfg) throw new StravaError("Strava non configurato");
  const res = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...body }),
  });
  if (!res.ok) throw new StravaError(`Token Strava rifiutato (${res.status})`, res.status);
  return res.json();
}

/** Completa il login: salva il collegamento con i token cifrati */
export async function connectStrava(userId: string, code: string, scope: string | null) {
  const token = await tokenRequest({ code, grant_type: "authorization_code" });
  if (!token.athlete) throw new StravaError("Risposta Strava senza atleta");
  const data = {
    athleteId: String(token.athlete.id),
    athleteName: [token.athlete.firstname, token.athlete.lastname].filter(Boolean).join(" ") || null,
    accessToken: encryptSecret(token.access_token),
    refreshToken: encryptSecret(token.refresh_token),
    expiresAt: new Date(token.expires_at * 1000),
    scope,
  };
  // Lo stesso atleta collegato a un altro account viene spostato su questo
  await prisma.stravaConnection.deleteMany({ where: { athleteId: data.athleteId, NOT: { userId } } });
  return prisma.stravaConnection.upsert({ where: { userId }, update: data, create: { ...data, userId } });
}

/** Token valido, rinnovato se scade entro 5 minuti */
async function accessToken(userId: string): Promise<string> {
  const conn = await prisma.stravaConnection.findUnique({ where: { userId } });
  if (!conn) throw new StravaError("Strava non collegato", 404);
  if (conn.expiresAt.getTime() - Date.now() > 5 * 60_000) return decryptSecret(conn.accessToken);

  const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptSecret(conn.refreshToken) });
  await prisma.stravaConnection.update({
    where: { userId },
    data: {
      accessToken: encryptSecret(token.access_token),
      refreshToken: encryptSecret(token.refresh_token),
      expiresAt: new Date(token.expires_at * 1000),
    },
  });
  return token.access_token;
}

async function api<T>(userId: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken(userId)}` } });
  if (res.status === 429) throw new StravaError("Limite di richieste Strava raggiunto: riprova tra 15 minuti", 429);
  if (!res.ok) throw new StravaError(`Errore Strava (${res.status})`, res.status);
  return res.json();
}

/** Attività Strava (riepilogo o dettaglio): solo i campi che usiamo */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
  description?: string | null;
  map?: { polyline?: string | null; summary_polyline?: string | null };
  splits_metric?: { split: number; distance: number; moving_time: number; elevation_difference?: number; average_heartrate?: number }[];
  best_efforts?: { name: string; distance: number; moving_time: number }[];
}

const EFFORT_NAMES: Record<string, string> = {
  "1k": "1 km",
  "1 mile": "1 miglio",
  "5k": "5 km",
  "10k": "10 km",
  "half-marathon": "Mezza maratona",
  marathon: "Maratona",
};

export const isRun = (a: Pick<StravaActivity, "sport_type" | "type">) => RUN_SPORT_TYPES.has(a.sport_type ?? a.type ?? "");

/** Attività Strava → corsa BodyGrowth */
export function mapStravaActivity(a: StravaActivity): RunInput {
  const detailed = Array.isArray(a.splits_metric);
  const splits: RunSplit[] | null = detailed
    ? a.splits_metric!.map((s) => ({
        km: s.split,
        distance: Math.round(s.distance),
        seconds: s.moving_time,
        ...(s.elevation_difference != null ? { elevation: Math.round(s.elevation_difference) } : {}),
        ...(s.average_heartrate != null ? { heartRate: Math.round(s.average_heartrate) } : {}),
      }))
    : null;
  const bestEfforts: BestEffort[] | null = a.best_efforts
    ? a.best_efforts
        .map((e) => ({ name: EFFORT_NAMES[e.name.toLowerCase()] ?? "", distance: e.distance, seconds: e.moving_time }))
        .filter((e) => e.name)
    : null;
  // La cadenza Strava per la corsa è "per piede": la riportiamo a passi/min
  const cadence = a.average_cadence ? Math.round(a.average_cadence < 120 ? a.average_cadence * 2 : a.average_cadence) : null;

  return {
    source: "STRAVA",
    externalId: String(a.id),
    name: a.name || "Corsa",
    sportType: a.sport_type ?? a.type ?? "Run",
    startedAt: new Date(a.start_date),
    distance: a.distance,
    movingTime: a.moving_time,
    elapsedTime: a.elapsed_time,
    elevationGain: a.total_elevation_gain ?? null,
    avgHeartRate: a.average_heartrate ?? null,
    maxHeartRate: a.max_heartrate ?? null,
    avgCadence: cadence,
    calories: a.calories ?? null,
    polyline: a.map?.polyline || a.map?.summary_polyline || null,
    splits,
    bestEfforts,
    detailed,
    notes: a.description ?? null,
  };
}

/** Importa (o aggiorna) una singola attività con tutti i dettagli */
export async function importActivity(userId: string, activityId: string, opts: { updateStreak?: boolean } = {}) {
  const activity = await api<StravaActivity>(userId, `/activities/${encodeURIComponent(activityId)}`);
  if (!isRun(activity)) return null;
  return saveRun(userId, mapStravaActivity(activity), opts);
}

/**
 * Scarica le corse dall'elenco attività (riepiloghi: percorso, km, tempi, FC).
 * Split e migliori tempi arrivano col dettaglio, letto quando apri la corsa
 * o dal webhook: così non si consumano centinaia di richieste.
 */
export async function syncActivities(userId: string, opts: { since?: Date; maxPages?: number } = {}) {
  const after = opts.since ? Math.floor(opts.since.getTime() / 1000) : undefined;
  let imported = 0;
  for (let page = 1; page <= (opts.maxPages ?? 5); page++) {
    const params = new URLSearchParams({ per_page: "100", page: String(page) });
    if (after) params.set("after", String(after));
    const list = await api<StravaActivity[]>(userId, `/athlete/activities?${params}`);
    for (const a of list.filter(isRun)) {
      await saveRun(userId, mapStravaActivity(a), { updateStreak: false });
      imported++;
    }
    if (list.length < 100) break;
  }
  await prisma.stravaConnection.update({ where: { userId }, data: { lastSyncAt: new Date() } });
  await updateUserStreak(userId);
  return imported;
}

/** Scollega: revoca l'accesso su Strava e cancella i token (le corse restano) */
export async function disconnectStrava(userId: string) {
  const conn = await prisma.stravaConnection.findUnique({ where: { userId } });
  if (!conn) return;
  try {
    await fetch(`${OAUTH}/deauthorize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken(userId)}` },
    });
  } catch {
    // Token già revocato da Strava: basta cancellare il collegamento
  }
  await prisma.stravaConnection.delete({ where: { userId } });
}

/** Iscrizione al webhook di Strava (una sola per l'app) */
export async function ensureWebhookSubscription(callbackUrl: string) {
  const cfg = stravaConfig();
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (!cfg || !verifyToken) throw new StravaError("Strava o STRAVA_WEBHOOK_VERIFY_TOKEN non configurati");

  const query = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret });
  const existing: { id: number; callback_url: string }[] = await fetch(`${API}/push_subscriptions?${query}`).then((r) =>
    r.ok ? r.json() : []
  );
  if (existing.some((s) => s.callback_url === callbackUrl)) return { status: "already-active" as const };
  for (const s of existing) {
    await fetch(`${API}/push_subscriptions/${s.id}?${query}`, { method: "DELETE" });
  }
  const res = await fetch(`${API}/push_subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, callback_url: callbackUrl, verify_token: verifyToken }),
  });
  if (!res.ok) throw new StravaError(`Iscrizione webhook rifiutata (${res.status}): ${await res.text()}`, res.status);
  return { status: "created" as const };
}
