/**
 * Client della Garmin Connect Personal API (ufficiale, gratuita, sola
 * lettura): la chiave personale creata su connect.garmin.com si scambia con
 * un token di accesso (JWT, 24 h) da usare come Bearer. Specifiche:
 * developer.garmin.com/gc-developer-program/personal/swagger-docs
 */

const BASE_URL = "https://personal.connectapi.garmin.com";
const TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token";
const TIMEOUT_MS = 20_000;
/** Senza `exp` leggibile il token si considera valido poco meno di un giorno */
const FALLBACK_TOKEN_MS = 23 * 3_600_000;

export class GarminError extends Error {
  constructor(
    message: string,
    /** chiave scaduta o revocata: serve una chiave nuova */
    readonly auth = false,
    /** Garmin limita le richieste: inutile insistere adesso */
    readonly rateLimited = false
  ) {
    super(message);
    this.name = "GarminError";
  }
}

export const isGarminAuthError = (error: unknown) => error instanceof GarminError && error.auth;

const KEY_EXPIRED = "Chiave Garmin non valida o scaduta: creane una nuova su Garmin Connect";

async function gfetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new GarminError("Garmin non raggiungibile: riprova tra poco");
  }
}

export interface GarminToken {
  accessToken: string;
  expiresAt: Date;
}

/** Scadenza (`exp`) di un JWT, senza verificarne la firma */
export function jwtExpiry(token: string): Date | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return typeof payload?.exp === "number" ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

/** Chiave personale → token di accesso */
export async function exchangeApiKey(apiKey: string): Promise<GarminToken> {
  const res = await gfetch(`${BASE_URL}${TOKEN_PATH}`, {
    method: "POST",
    headers: { Accept: "*/*", Authorization: `ApiKey ${apiKey}` },
  });
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new GarminError(KEY_EXPIRED, true);
  if (res.status === 429) throw new GarminError("Garmin: troppe richieste, riprova più tardi", false, true);
  if (!res.ok) throw new GarminError(`Garmin non risponde (${res.status})`);
  const accessToken = (await res.text()).trim();
  if (!accessToken || accessToken.length > 8_000) throw new GarminError("Garmin non ha restituito il token di accesso");
  return { accessToken, expiresAt: jwtExpiry(accessToken) ?? new Date(Date.now() + FALLBACK_TOKEN_MS) };
}

type Query = Record<string, string | number | boolean | undefined>;

/**
 * Richieste autenticate. Con un 401 il token si rinnova una volta (può essere
 * stato revocato prima della scadenza); se la chiave non vale più, errore auth.
 */
export class GarminClient {
  constructor(
    private token: string,
    private readonly renew: () => Promise<string>
  ) {}

  private async send(path: string, query: Query | undefined, accept: string, retried = false): Promise<Response | null> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) params.set(key, String(value));
    const url = `${BASE_URL}${path}${params.size ? `?${params}` : ""}`;
    const res = await gfetch(url, { headers: { Accept: accept, Authorization: `Bearer ${this.token}` } });
    if (res.status === 401 && !retried) {
      this.token = await this.renew();
      return this.send(path, query, accept, true);
    }
    if (res.status === 401 || res.status === 403) throw new GarminError(KEY_EXPIRED, true);
    if (res.status === 429) throw new GarminError("Garmin: troppe richieste, riprova più tardi", false, true);
    // Giorno senza dati
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw new GarminError(`Errore Garmin (${res.status})`);
    return res;
  }

  async json<T>(path: string, query?: Query): Promise<T | null> {
    const res = await this.send(path, query, "application/json");
    if (!res) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GarminError("Risposta Garmin non leggibile");
    }
  }

  async binary(path: string): Promise<Buffer | null> {
    const res = await this.send(path, undefined, "*/*");
    return res ? Buffer.from(await res.arrayBuffer()) : null;
  }
}

// ─── Forme delle risposte (solo i campi usati) ────────────────────────────────

export interface GarminActivity {
  activityId?: number;
  activityName?: string;
  startTimeGMT?: string;
  activityType?: { typeId?: number; typeKey?: string; parentTypeId?: number };
  distance?: number;
  duration?: number;
  elapsedDuration?: number;
  movingDuration?: number;
  elevationGain?: number;
  averageHR?: number;
  maxHR?: number;
  averageRunningCadenceInStepsPerMinute?: number;
  calories?: number;
  hasPolyline?: boolean;
  /** Allenamenti di forza: esercizi con serie, ripetizioni, volume (g) e carico massimo (g) */
  summarizedExerciseSets?: {
    category?: string;
    subCategory?: string;
    reps?: number;
    sets?: number;
    volume?: number;
    maxWeight?: number;
  }[];
}

interface MovementValue {
  value?: number;
  distanceInMeters?: number;
}

export interface GarminDailySummary {
  calendarDate?: string;
  includesWellnessData?: boolean;
  movement?: { steps?: MovementValue | number };
  calories?: { burnedActive?: number };
  heartRate?: { minValue?: number; maxValue?: number; restingValue?: number };
  stress?: { avgLevel?: number; maxLevel?: number };
  pulseOx?: { avgValue?: number; minValue?: number };
}

/** Istante come lo dà Garmin: ms, stringa numerica, ISO senza fuso (UTC) o { date } */
export type GarminTime = number | string | { date?: string } | null | undefined;

export interface GarminNap {
  napStartTimestampGMT?: GarminTime;
  napEndTimestampGMT?: GarminTime;
  napTimeSec?: number;
  napStartTimeOffset?: number;
  calendarDate?: string;
}

export interface GarminSleep {
  id?: number;
  calendarDate?: string;
  sleepTimeSeconds?: number;
  sleepStartTimestampGMT?: GarminTime;
  sleepEndTimestampGMT?: GarminTime;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSleepSeconds?: number;
  /** false sugli orologi che non distinguono il REM: il valore 0 non è una misura */
  deviceRemCapable?: boolean;
  awakeCount?: number;
  avgHeartRate?: number;
  averageRespirationValue?: number;
  sleepScores?: Record<string, { value?: number } | undefined>;
  dailyNapDTOS?: GarminNap[];
  /**
   * Fasi minuto per minuto nel formato di Garmin Connect (0 profondo,
   * 1 leggero, 2 REM, 3 sveglio). Non è nella specifica della Personal API:
   * si legge solo se Garmin la invia.
   */
  sleepLevels?: { startGMT?: GarminTime; endGMT?: GarminTime; activityLevel?: number }[];
}

export interface GarminDailyHeartRate {
  calendarDate?: string | { localDate?: string };
  startTimestampGMT?: GarminTime;
  startTimestampLocal?: GarminTime;
  maxHeartRate?: number;
  minHeartRate?: number;
  restingHeartRate?: number;
  heartRateValueDescriptors?: { index?: number; key?: string }[];
  heartRateValues?: unknown[][];
}

export interface GarminProfileSettings {
  displayName?: string;
  timeZone?: string;
}

// ─── Endpoint ────────────────────────────────────────────────────────────────

/** Attività dal più recente; date locali yyyy-MM-dd incluse */
export const searchActivities = (
  client: GarminClient,
  opts: { startDate: string; endDate: string; start: number; limit: number }
) =>
  client
    .json<GarminActivity[]>("/activitylist-service/activities/search/activities", { ...opts, sortOrder: "desc" })
    .then((list) => (Array.isArray(list) ? list : []));

/** Riepiloghi giornalieri (passi, calorie, FC, stress, SpO₂…), fino a un anno */
export const dailySummaries = (client: GarminClient, startDate: string, endDate: string) =>
  client
    .json<{ data?: GarminDailySummary[] }>("/usersummary-service/v2/dailysummaries", { startDate, endDate })
    .then((body) => body?.data ?? []);

/** Notti (e pisolini) dei giorni indicati, al massimo 31 */
export const sleepSummaries = (client: GarminClient, startDate: string, endDate: string) =>
  client
    .json<GarminSleep[]>("/sleep-service/sleep/dailySleepSummariesByDate", { startDate, endDate })
    .then((list) => (Array.isArray(list) ? list : []));

/** Battiti del giorno, campioni compresi */
export const dailyHeartRate = (client: GarminClient, date: string) =>
  client.json<GarminDailyHeartRate>("/wellness-service/wellness/dailyHeartRate", { date });

/** File originale dell'attività (zip con il .fit) */
export const downloadActivity = (client: GarminClient, activityId: string) =>
  client.binary(`/download-service/files/activity/${encodeURIComponent(activityId)}`);

export const profileSettings = (client: GarminClient) =>
  client.json<GarminProfileSettings>("/userprofile-service/userprofile/settings");
