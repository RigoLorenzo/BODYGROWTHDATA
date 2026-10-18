import { createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Protocollo dell'app Mi Fitness (Xiaomi): richieste firmate e cifrate RC4,
 * file FDS cifrati AES-CBC. Ricostruito dai progetti open source
 * kevinkwee/Mi-Fitness-Sync (MIT) e HUAYUE1024/mi-fitness-mcp-cn.
 * API non ufficiale: Xiaomi può cambiarla senza preavviso.
 */

const b64 = (buf: Buffer) => buf.toString("base64");
const fromB64 = (value: string) => Buffer.from(value, "base64");

/** RC4 con i primi 1024 byte del keystream scartati (come l'app) */
export class Rc4 {
  private s = Array.from({ length: 256 }, (_, i) => i);
  private i = 0;
  private j = 0;

  constructor(key: Buffer) {
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + this.s[i] + key[i % key.length]) & 0xff;
      [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
    }
    this.apply(Buffer.alloc(1024));
  }

  apply(data: Buffer): Buffer {
    const out = Buffer.from(data);
    for (let k = 0; k < out.length; k++) {
      this.i = (this.i + 1) & 0xff;
      const si = this.s[this.i];
      this.j = (this.j + si) & 0xff;
      [this.s[this.i], this.s[this.j]] = [this.s[this.j], this.s[this.i]];
      out[k] ^= this.s[(this.s[this.i] + si) & 0xff];
    }
    return out;
  }
}

/** 8 byte casuali + minuti dall'epoch (int32 big endian), in base64 */
export function generateNonce(now = Date.now()): string {
  const buf = Buffer.alloc(12);
  randomBytes(8).copy(buf);
  buf.writeInt32BE(Math.floor(now / 60_000), 8);
  return b64(buf);
}

export const signedNonce = (ssecurity: string, nonce: string): string =>
  b64(createHash("sha256").update(Buffer.concat([fromB64(ssecurity), fromB64(nonce)])).digest());

/** SHA1("METODO&/path&k=v…&signedNonce") in base64, chiavi in ordine */
export function buildSignature(method: string, path: string, params: Record<string, string>, nonceSigned: string): string {
  const parts = [method.toUpperCase(), new URL(path, "https://x").pathname];
  for (const key of Object.keys(params).sort()) parts.push(`${key}=${params[key]}`);
  parts.push(nonceSigned);
  return b64(createHash("sha1").update(parts.join("&")).digest());
}

/** Parametri della richiesta: firmati, cifrati RC4, poi firmati di nuovo */
export function encryptParams(opts: {
  method: string;
  path: string;
  params: Record<string, string>;
  nonce: string;
  ssecurity: string;
}): Record<string, string> {
  const key = signedNonce(opts.ssecurity, opts.nonce);
  const plain: Record<string, string> = Object.fromEntries(Object.entries(opts.params).filter(([k, v]) => k && v));
  plain.rc4_hash__ = buildSignature(opts.method, opts.path, plain, key);

  const cipher = new Rc4(fromB64(key));
  const encrypted: Record<string, string> = {};
  for (const name of Object.keys(plain).sort()) {
    encrypted[name] = b64(cipher.apply(Buffer.from(plain[name], "utf8")));
  }
  encrypted.signature = buildSignature(opts.method, opts.path, encrypted, key);
  encrypted._nonce = opts.nonce;
  return encrypted;
}

export function decryptResponse<T = unknown>(body: string, nonce: string, ssecurity: string): T {
  const cipher = new Rc4(fromB64(signedNonce(ssecurity, nonce)));
  return JSON.parse(cipher.apply(fromB64(body.trim())).toString("utf8")) as T;
}

/** Firma del passaggio STS del login: base64(SHA1("nonce=N&ssecurity")) */
export const clientSign = (nonce: string, ssecurity: string): string =>
  b64(createHash("sha1").update(`nonce=${nonce}&${ssecurity}`).digest());

/** Le risposte del login Xiaomi iniziano con un prefisso anti-JSON-hijacking */
export function parseLoginPayload<T = Record<string, unknown>>(text: string): T {
  return JSON.parse(text.trim().replace(/^&&&START&&&/, "")) as T;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Tipi di file FDS di un allenamento */
export const FDS_FILE = { record: 0, report: 1, gps: 2, recovery: 3 } as const;

/** Suffisso con cui il cloud indicizza i file FDS di un allenamento */
export function fdsSuffix(opts: { sid: string; timestamp: number; timezone: number; protoType: number; fileType: number }) {
  const key = Buffer.alloc(6);
  key.writeUInt32LE(opts.timestamp >>> 0, 0);
  key[4] = opts.timezone & 0xff;
  key[5] = ((1 << 7) + (opts.protoType << 2) + opts.fileType) & 0xff;
  return `${b64url(key)}_${b64url(createHash("sha1").update(opts.sid).digest())}`;
}

const FDS_IV = Buffer.from("1234567887654321", "ascii");

/** File FDS: base64url cifrato AES-CBC con la chiave dell'oggetto */
export function decryptFds(body: string, objectKey: string): Buffer {
  const key = Buffer.from(objectKey, "base64url");
  const algorithm = key.length === 32 ? "aes-256-cbc" : key.length === 24 ? "aes-192-cbc" : "aes-128-cbc";
  const decipher = createDecipheriv(algorithm, key, FDS_IV);
  return Buffer.concat([decipher.update(Buffer.from(body.trim().replace(/^"|"$/g, ""), "base64url")), decipher.final()]);
}

/** Campionamento GPS del file FDS di tipo 2 */
export interface GpsSample {
  time: number; // secondi
  lat: number;
  lon: number;
  altitude?: number;
  speed?: number;
}

interface GpsField {
  id: "time" | "lon" | "lat" | "accuracy" | "speed" | "source" | "altitude" | "hdop";
  bytes: number;
  since: number;
  float?: boolean;
}

/** Campi in ordine di serializzazione e versione minima del formato */
const GPS_FIELDS: GpsField[] = [
  { id: "time", bytes: 4, since: 1 },
  { id: "lon", bytes: 4, since: 1, float: true },
  { id: "lat", bytes: 4, since: 1, float: true },
  { id: "accuracy", bytes: 4, since: 2, float: true },
  { id: "speed", bytes: 2, since: 2 },
  { id: "source", bytes: 0, since: 2 },
  { id: "altitude", bytes: 4, since: 3, float: true },
  { id: "hdop", bytes: 4, since: 3, float: true },
];

/** Intestazione: timestamp(4) tz(1) versione(1) sport(1) + 1 byte + bitmap validità */
const HEADER_LEN = 8;
const GPS_VALID_LEN: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 1 };

export function parseGpsFds(data: Buffer): GpsSample[] {
  if (data.length < HEADER_LEN) return [];
  const version = data[5];
  const validLen = GPS_VALID_LEN[version];
  if (!validLen || data.length < HEADER_LEN + validLen) return [];

  // Bitmap MSB-first: un bit per ogni campo supportato da questa versione
  const validBits = data.subarray(HEADER_LEN, HEADER_LEN + validLen);
  const fields = GPS_FIELDS.filter((f) => f.since <= version);
  const valid = new Map(fields.map((f, i) => [f.id, !!(validBits[i >> 3] & (1 << (7 - (i & 7))))]));
  if (!valid.get("time") || !valid.get("lat") || !valid.get("lon")) return [];

  const body = data.subarray(HEADER_LEN + validLen);
  const recordBytes = fields.reduce((sum, f) => sum + f.bytes, 0);
  let offset = 0;
  let count = Math.floor(body.length / recordBytes);
  if (version >= 4) {
    if (body.length < 4) return [];
    count = body.readUInt32LE(0);
    offset = 4;
  }

  const samples: GpsSample[] = [];
  for (let n = 0; n < count && offset + recordBytes <= body.length; n++) {
    const raw: Partial<Record<GpsField["id"], number>> = {};
    for (const f of fields) {
      if (!f.bytes) continue;
      const value = f.float
        ? body.readFloatLE(offset)
        : f.bytes === 4
          ? body.readUInt32LE(offset)
          : f.bytes === 2
            ? body.readUInt16LE(offset)
            : body[offset];
      offset += f.bytes;
      if (valid.get(f.id)) raw[f.id] = value;
    }
    if (raw.time == null || raw.lat == null || raw.lon == null) continue;
    samples.push({
      time: raw.time,
      lat: raw.lat,
      lon: raw.lon,
      ...(raw.altitude != null ? { altitude: raw.altitude } : {}),
      ...(raw.speed != null ? { speed: ((raw.speed & 0xfff0) >> 4) / 10 } : {}),
    });
  }
  return samples;
}
