/**
 * Lettore minimo di file FIT (formato binario di Garmin): solo i messaggi
 * "record" (n. 20), cioè i punti della traccia. Gestisce definizioni locali,
 * architettura little/big endian, campi sviluppatore e intestazioni a
 * timestamp compresso; tutti gli altri messaggi si saltano.
 * Riferimento: FIT SDK, "Flexible & Interoperable Data Transfer Protocol".
 */

/** 31/12/1989 00:00 UTC: zero dei timestamp FIT */
const FIT_EPOCH = 631_065_600;
const RECORD_MESSAGE = 20;
const TIMESTAMP_FIELD = 253;
/** Gradi per semicerchio */
const SEMICIRCLE = 180 / 2 ** 31;

const FIELD = { lat: 0, lon: 1, altitude: 2, heartRate: 3, distance: 5, enhancedAltitude: 78 } as const;

export interface FitRecord {
  /** secondi epoch */
  time: number;
  lat?: number;
  lon?: number;
  /** metri */
  altitude?: number;
  heartRate?: number;
  /** metri dall'inizio */
  distance?: number;
}

interface FieldDef {
  num: number;
  size: number;
  /** tipo base FIT: il bit 0x80 indica i tipi a più byte, i 5 bit bassi il tipo */
  type: number;
}

interface Definition {
  global: number;
  little: boolean;
  fields: FieldDef[];
  devSize: number;
}

export const isFit = (buf: Buffer) => buf.length >= 12 && buf.toString("ascii", 8, 12) === ".FIT";

const SIGNED_32 = 0x05;

/** Valore intero di un campo (null se "non valido" per il suo tipo) */
function readInt(buf: Buffer, pos: number, field: FieldDef, little: boolean): number | null {
  switch (field.size) {
    case 1: {
      const v = buf.readUInt8(pos);
      return v === 0xff ? null : v;
    }
    case 2: {
      const v = little ? buf.readUInt16LE(pos) : buf.readUInt16BE(pos);
      return v === 0xffff ? null : v;
    }
    case 4: {
      if ((field.type & 0x1f) === SIGNED_32) {
        const v = little ? buf.readInt32LE(pos) : buf.readInt32BE(pos);
        return v === 0x7fffffff ? null : v;
      }
      const v = little ? buf.readUInt32LE(pos) : buf.readUInt32BE(pos);
      return v === 0xffffffff ? null : v;
    }
    default:
      return null;
  }
}

function toRecord(values: Map<number, number>, time: number): FitRecord {
  const record: FitRecord = { time: time + FIT_EPOCH };
  const lat = values.get(FIELD.lat);
  const lon = values.get(FIELD.lon);
  if (lat != null && lon != null) {
    record.lat = lat * SEMICIRCLE;
    record.lon = lon * SEMICIRCLE;
  }
  // Scala 5, offset 500
  const altitude = values.get(FIELD.enhancedAltitude) ?? values.get(FIELD.altitude);
  if (altitude != null) record.altitude = altitude / 5 - 500;
  const hr = values.get(FIELD.heartRate);
  if (hr != null && hr > 0) record.heartRate = hr;
  const distance = values.get(FIELD.distance);
  if (distance != null) record.distance = distance / 100;
  return record;
}

/** Punti della traccia in ordine di registrazione; un file troncato restituisce quelli letti */
export function parseFitRecords(buf: Buffer): FitRecord[] {
  if (!isFit(buf)) throw new Error("Non è un file FIT");
  const headerSize = buf[0];
  const end = Math.min(buf.length, headerSize + buf.readUInt32LE(4));
  const definitions = new Map<number, Definition>();
  const records: FitRecord[] = [];
  let lastTimestamp = 0;
  let pos = headerSize;

  const readData = (def: Definition, compressedTime: number | null) => {
    const size = def.fields.reduce((sum, f) => sum + f.size, 0) + def.devSize;
    if (pos + size > end) return false;
    const wanted = def.global === RECORD_MESSAGE;
    const values = new Map<number, number>();
    let at = pos;
    for (const field of def.fields) {
      if (field.num === TIMESTAMP_FIELD || wanted) {
        const v = readInt(buf, at, field, def.little);
        if (v != null) values.set(field.num, v);
      }
      at += field.size;
    }
    pos += size;
    const timestamp = values.get(TIMESTAMP_FIELD) ?? compressedTime;
    if (timestamp != null) lastTimestamp = timestamp;
    if (wanted && timestamp != null) records.push(toRecord(values, timestamp));
    return true;
  };

  while (pos < end) {
    const header = buf[pos++];
    if (header & 0x80) {
      // Timestamp compresso: 5 bit di scostamento dall'ultimo timestamp completo
      const def = definitions.get((header >> 5) & 0x03);
      if (!def) break;
      const offset = header & 0x1f;
      let time = lastTimestamp - (lastTimestamp % 32) + offset;
      if (offset < lastTimestamp % 32) time += 32;
      if (!readData(def, time)) break;
    } else if (header & 0x40) {
      if (pos + 5 > end) break;
      const little = buf[pos + 1] === 0;
      const global = little ? buf.readUInt16LE(pos + 2) : buf.readUInt16BE(pos + 2);
      const count = buf[pos + 4];
      pos += 5;
      if (pos + count * 3 > end) break;
      const fields: FieldDef[] = [];
      for (let i = 0; i < count; i++, pos += 3) fields.push({ num: buf[pos], size: buf[pos + 1], type: buf[pos + 2] });
      let devSize = 0;
      if (header & 0x20) {
        const devCount = buf[pos++];
        if (pos + devCount * 3 > end) break;
        for (let i = 0; i < devCount; i++, pos += 3) devSize += buf[pos + 1];
      }
      definitions.set(header & 0x0f, { global, little, fields, devSize });
    } else {
      const def = definitions.get(header & 0x0f);
      if (!def || !readData(def, null)) break;
    }
  }
  return records;
}
