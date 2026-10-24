import { randomBytes } from "crypto";
import {
  FDS_FILE,
  clientSign,
  decryptFds,
  decryptResponse,
  encryptParams,
  fdsSuffix,
  generateNonce,
  parseGpsFds,
  parseLoginPayload,
  type GpsSample,
} from "./protocol";

/**
 * Client del cloud Mi Fitness: login con passToken (mai la password),
 * elenco allenamenti e traccia GPS. API non ufficiale.
 */

const ACCOUNT = "https://account.xiaomi.com";
const SERVICE_ID = "miothealth";
const USER_AGENT = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const TIMEOUT_MS = 20_000;

/** Regioni del cloud salute; "de" serve l'Europa (Italia compresa) */
export const REGIONS = ["de", "sg", "us", "i2", "ru", "cn"] as const;

export class MiFitnessError extends Error {
  constructor(message: string, readonly auth = false) {
    super(message);
    this.name = "MiFitnessError";
  }
}

export interface XiaomiSession {
  userId: string;
  /** Xiaomi può ruotarlo a ogni login: va salvato quello nuovo */
  passToken: string;
  ssecurity: string;
  cookie: string;
}

interface LoginPayload {
  code?: number;
  userId?: number | string;
  cUserId?: string;
  passToken?: string;
  ssecurity?: string;
  nonce?: number | string;
  location?: string;
  desc?: string;
}

/** Rete assente o timeout diventano un messaggio leggibile */
async function xfetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new MiFitnessError("Xiaomi non raggiungibile: riprova tra poco");
  }
}

const cookiePairs = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";", 1)[0]);

/** Link STS, con la firma del client se richiesta */
function stsUrl(location: string, sign: { nonce?: number | string; ssecurity?: string } | null): string {
  if (!sign || sign.nonce == null || !sign.ssecurity || location.includes("clientSign=")) return location;
  const url = new URL(location);
  url.searchParams.set("clientSign", clientSign(String(sign.nonce), sign.ssecurity));
  url.searchParams.set("_userIdNeedEncrypt", "true");
  return url.toString();
}

/**
 * Passaggio STS: il serviceToken arriva in un cookie, anche dopo redirect.
 * La traccia (stato, host, nomi dei cookie; mai i valori) serve alla diagnosi.
 */
async function followSts(start: string): Promise<{ serviceToken?: string; trace: string }> {
  const cookies = new Map<string, string>();
  const trace: string[] = [];
  let url = start;
  for (let hop = 0; hop < 5 && url; hop++) {
    const res = await xfetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const names: string[] = [];
    for (const pair of cookiePairs(res)) {
      const [name, ...value] = pair.split("=");
      cookies.set(name, value.join("="));
      names.push(name);
    }
    trace.push(`${res.status} ${new URL(url).host}${names.length ? ` [${names.join(",")}]` : ""}`);
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    url = next ? new URL(next, url).toString() : "";
  }
  const name = [`${SERVICE_ID}_serviceToken`, "serviceToken", ...cookies.keys()].find(
    (n) => /serviceToken$/i.test(n) && cookies.get(n)
  );
  return { serviceToken: name ? cookies.get(name) : undefined, trace: trace.join(" → ") };
}

/** passToken → sessione del servizio salute (ssecurity + serviceToken) */
export async function login(userId: string, passToken: string): Promise<XiaomiSession> {
  const deviceId = randomBytes(8).toString("hex").toUpperCase();
  const res = await xfetch(`${ACCOUNT}/pass/serviceLogin?_json=true&sid=${SERVICE_ID}`, {
    headers: { Cookie: `userId=${userId}; passToken=${passToken}; deviceId=${deviceId}`, "User-Agent": USER_AGENT },
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new MiFitnessError(`Login Xiaomi rifiutato (${res.status})`, res.status === 401 || res.status === 403);
  const payload = parseLoginPayload<LoginPayload>(await res.text());
  if (!payload.ssecurity || !payload.location) {
    // Token revocato o scaduto: serve un nuovo accesso
    throw new MiFitnessError("Accesso Xiaomi scaduto: ricollega Mi Fitness", true);
  }

  // I progetti di riferimento usano due varianti: link così com'è, oppure firmato
  const traces: string[] = [];
  let serviceToken: string | undefined;
  for (const signed of [false, true]) {
    const sts = await followSts(stsUrl(payload.location, signed ? payload : null));
    traces.push(`${signed ? "firmato" : "semplice"}: ${sts.trace}`);
    serviceToken = sts.serviceToken;
    if (serviceToken) break;
  }
  if (!serviceToken) {
    console.error("Mi Fitness STS senza serviceToken", traces);
    throw new MiFitnessError(`Xiaomi non ha restituito il token del servizio salute (${traces.join(" | ")})`);
  }

  const id = String(payload.userId ?? userId);
  const cookie = [
    `serviceToken=${serviceToken}`,
    `userId=${id}`,
    ...(payload.cUserId ? [`cUserId=${payload.cUserId}`] : []),
    "locale=it_IT",
  ].join("; ");
  return { userId: id, passToken: payload.passToken || passToken, ssecurity: payload.ssecurity, cookie };
}

const apiHost = (region: string) => `https://${region === "cn" ? "" : `${region}.`}hlth.io.mi.com`;

/** Richiesta firmata: parametri cifrati RC4, risposta cifrata con lo stesso nonce */
async function request<T>(session: XiaomiSession, region: string, path: string, payload: object, signaturePath = path): Promise<T> {
  const nonce = generateNonce();
  const params = encryptParams({
    method: "GET",
    path: signaturePath,
    params: { data: JSON.stringify(payload) },
    nonce,
    ssecurity: session.ssecurity,
  });
  const res = await xfetch(`${apiHost(region)}${path}?${new URLSearchParams(params)}`, {
    headers: { Cookie: session.cookie, region_tag: region, "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403) throw new MiFitnessError("Sessione Mi Fitness non valida", true);
  if (!res.ok) throw new MiFitnessError(`Errore Mi Fitness (${res.status})`);
  const body = decryptResponse<{ code?: number; message?: string; result?: T }>(await res.text(), nonce, session.ssecurity);
  if (body.code !== 0) throw new MiFitnessError(body.message || `Errore Mi Fitness (codice ${body.code})`);
  return body.result as T;
}

/** Allenamento come arriva dal cloud: il riepilogo è JSON dentro `value` */
export interface SportRecord {
  sid?: string;
  key?: string;
  time?: number;
  category?: string;
  deleted?: boolean;
  zone_offset?: number;
  value?: string;
}

export interface SportRecordPage {
  records: SportRecord[];
  hasMore: boolean;
  nextKey: string | null;
}

/** Allenamenti dal più recente, con paginazione a chiave */
export async function listSportRecords(
  session: XiaomiSession,
  region: string,
  opts: { startTime?: number; endTime?: number; limit?: number; nextKey?: string | null }
): Promise<SportRecordPage> {
  const result = await request<{ sport_records?: SportRecord[]; has_more?: boolean; next_key?: string }>(
    session,
    region,
    "/app/v1/data/get_sport_records_by_time",
    {
      reverse: true,
      limit: opts.limit ?? 50,
      ...(opts.startTime ? { startTime: opts.startTime } : {}),
      ...(opts.endTime ? { endTime: opts.endTime } : {}),
      ...(opts.nextKey ? { next_key: opts.nextKey } : {}),
    }
  );
  return { records: result?.sport_records ?? [], hasMore: !!result?.has_more, nextKey: result?.next_key || null };
}

/** Dato salute come arriva dal cloud: il contenuto è JSON dentro `value` */
export interface FitnessRecord {
  sid?: string;
  key?: string;
  time?: number;
  /** secondi rispetto a UTC */
  zone_offset?: number;
  zone_name?: string;
  value?: string | Record<string, unknown>;
}

/** Chiavi del cloud salute lette dalla sezione Benessere */
export type FitnessKey = "heart_rate" | "resting_heart_rate" | "sleep" | "steps" | "calories" | "spo2" | "stress";

/** Dati salute di un tipo in un intervallo (secondi), una pagina alla volta */
export async function listFitnessData(
  session: XiaomiSession,
  region: string,
  // Altre chiavi solo per la diagnostica
  opts: { key: FitnessKey | (string & {}); startTime: number; endTime: number; nextKey?: string | null }
): Promise<{ records: FitnessRecord[]; hasMore: boolean; nextKey: string | null }> {
  const result = await request<{ data_list?: FitnessRecord[]; has_more?: boolean; next_key?: string }>(
    session,
    region,
    "/app/v1/data/get_fitness_data_by_time",
    {
      start_time: opts.startTime,
      end_time: opts.endTime,
      key: opts.key,
      ...(opts.nextKey ? { next_key: opts.nextKey } : {}),
    }
  );
  return { records: result?.data_list ?? [], hasMore: !!result?.has_more, nextKey: result?.next_key || null };
}

/** Riepilogo giornaliero: `time` è la mezzanotte UTC del giorno locale che rappresenta */
export interface DailyReportRecord extends FitnessRecord {
  tag?: string;
  source_sid_list?: string[];
}

/**
 * Riepiloghi giornalieri (tag daily_report), quelli che mostra l'app Mi
 * Fitness: sonno con punteggio e sessioni, FC a riposo. Arrivano anche
 * quando mancano i dati grezzi. Giorni con startTime < time <= endTime.
 */
export async function listDailyReport(
  session: XiaomiSession,
  region: string,
  opts: { key: string; startTime: number; endTime: number; nextKey?: string | null }
): Promise<{ records: DailyReportRecord[]; hasMore: boolean; nextKey: string | null }> {
  const result = await request<{ data_list?: DailyReportRecord[]; has_more?: boolean; next_key?: string }>(
    session,
    region,
    "/app/v1/data/get_aggregated_fitness_data_by_time",
    {
      tag: "daily_report",
      key: opts.key,
      start_time: opts.startTime,
      end_time: opts.endTime,
      reverse: true,
      limit: 50,
      ...(opts.nextKey ? { next_key: opts.nextKey } : {}),
    }
  );
  return { records: result?.data_list ?? [], hasMore: !!result?.has_more, nextKey: result?.next_key || null };
}

/** La regione giusta è quella che contiene gli allenamenti dell'account */
export async function discoverRegion(session: XiaomiSession): Promise<string> {
  const startTime = Math.floor(Date.now() / 1000) - 2 * 365 * 86_400;
  const now = Math.floor(Date.now() / 1000);
  // Senza allenamenti basta un giorno di passi
  const probes = [
    (region: string) => listSportRecords(session, region, { startTime, limit: 1 }),
    (region: string) => listFitnessData(session, region, { key: "steps", startTime: now - 7 * 86_400, endTime: now }),
  ];
  for (const probe of probes) {
    for (const region of REGIONS) {
      try {
        if ((await probe(region)).records.length) return region;
      } catch (error) {
        if (error instanceof MiFitnessError && error.auth) throw error;
      }
    }
  }
  return "de";
}

/** Riferimenti per scaricare i file FDS di un allenamento */
export interface FdsContext {
  sid: string;
  timestamp: number;
  protoType: number;
  timezone: number;
}

/** Traccia GPS dell'allenamento; vuota se l'orologio non l'ha registrata */
export async function downloadGpsTrack(session: XiaomiSession, region: string, ctx: FdsContext): Promise<GpsSample[]> {
  const suffix = fdsSuffix({ ...ctx, fileType: FDS_FILE.gps });
  const result = await request<Record<string, { url?: string; obj_key?: string }>>(
    session,
    region,
    "/healthapp/service/gen_download_url",
    { did: ctx.sid, items: [{ timestamp: ctx.timestamp, suffix }] },
    "/service/gen_download_url"
  );
  const entry = result?.[`${suffix}_${ctx.timestamp}`];
  if (!entry?.url || !entry.obj_key) return [];

  const res = await xfetch(entry.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return [];
  return parseGpsFds(decryptFds(await res.text(), entry.obj_key));
}

/** Login con QR o link: Xiaomi risponde sul long polling quando confermi */
export async function startQrLogin(): Promise<{ qrImage: string; loginUrl: string; lp: string; expiresIn: number }> {
  const params = new URLSearchParams({
    _qrsize: "360",
    qs: "%3Fsid%3Dxiaomiio%26_json%3Dtrue",
    callback: "https://sts.api.io.mi.com/sts",
    _hasLogo: "false",
    sid: "xiaomiio",
    serviceParam: "",
    _locale: "it_IT",
    _dc: String(Date.now()),
  });
  const res = await xfetch(`${ACCOUNT}/longPolling/loginUrl?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new MiFitnessError(`Xiaomi non risponde (${res.status})`);
  const data = parseLoginPayload<{ qr?: string; lp?: string; loginUrl?: string; timeout?: number }>(await res.text());
  if (!data.qr || !data.lp) throw new MiFitnessError("Xiaomi non ha generato il QR di accesso");

  const png = await xfetch(data.qr, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const qrImage = png.ok ? `data:image/png;base64,${Buffer.from(await png.arrayBuffer()).toString("base64")}` : "";
  return { qrImage, loginUrl: data.loginUrl ?? "", lp: data.lp, expiresIn: data.timeout ?? 300 };
}

export type QrPollResult = { status: "waiting" } | { status: "confirmed"; userId: string; passToken: string };

/** Attende la conferma fino a `waitMs`; dopo si riprova (le funzioni serverless hanno un limite) */
export async function pollQrLogin(lp: string, waitMs: number): Promise<QrPollResult> {
  try {
    const res = await fetch(lp, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(waitMs) });
    if (!res.ok) return { status: "waiting" };
    const body = parseLoginPayload<LoginPayload>(await res.text());
    if (body.code === 0 && body.userId && body.passToken) {
      return { status: "confirmed", userId: String(body.userId), passToken: body.passToken };
    }
  } catch {
    // Timeout del long polling: nessuna conferma ancora
  }
  return { status: "waiting" };
}
