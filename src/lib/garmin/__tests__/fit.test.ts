import { describe, expect, it } from "@jest/globals";
import { deflateRawSync } from "zlib";
import { isFit, parseFitRecords } from "../fit";
import { extractEntry, isZip } from "../zip";

const FIT_EPOCH = 631_065_600;
const DEG = 2 ** 31 / 180;

/** Costruisce un .fit: definizione del record (n. 20) e punti, little o big endian */
function buildFit(points: { t: number; lat: number; lon: number; ele: number; hr: number }[], opts: { bigEndian?: boolean; compressed?: boolean } = {}) {
  const big = !!opts.bigEndian;
  const chunks: Buffer[] = [];
  const u16 = (v: number) => {
    const b = Buffer.alloc(2);
    if (big) b.writeUInt16BE(v);
    else b.writeUInt16LE(v);
    return b;
  };
  const i32 = (v: number) => {
    const b = Buffer.alloc(4);
    if (big) b.writeInt32BE(v);
    else b.writeInt32LE(v);
    return b;
  };
  const u32 = (v: number) => {
    const b = Buffer.alloc(4);
    if (big) b.writeUInt32BE(v);
    else b.writeUInt32LE(v);
    return b;
  };
  // Messaggio "file_id" (0) da saltare, con un campo sviluppatore
  chunks.push(Buffer.from([0x60, 0, big ? 1 : 0]), u16(0), Buffer.from([1, 0, 1, 0x00, 1, 1, 2, 0]));
  chunks.push(Buffer.from([0x00, 4, 0xaa, 0xbb]));
  // Definizione record: timestamp, lat, lon, enhanced_altitude, heart_rate
  chunks.push(Buffer.from([0x41, 0, big ? 1 : 0]), u16(20), Buffer.from([5, 253, 4, 0x86, 0, 4, 0x85, 1, 4, 0x85, 78, 4, 0x86, 3, 1, 0x02]));
  // Definizione senza timestamp per le intestazioni compresse (tipo locale 2)
  chunks.push(Buffer.from([0x42, 0, big ? 1 : 0]), u16(20), Buffer.from([4, 0, 4, 0x85, 1, 4, 0x85, 78, 4, 0x86, 3, 1, 0x02]));
  points.forEach((p, i) => {
    const body = [i32(Math.round(p.lat * DEG)), i32(Math.round(p.lon * DEG)), u32((p.ele + 500) * 5), Buffer.from([p.hr])];
    if (opts.compressed && i > 0) {
      chunks.push(Buffer.from([0x80 | (2 << 5) | ((p.t - FIT_EPOCH) & 0x1f)]), ...body);
    } else {
      chunks.push(Buffer.from([0x01]), u32(p.t - FIT_EPOCH), ...body);
    }
  });
  const data = Buffer.concat(chunks);
  const header = Buffer.alloc(14);
  header[0] = 14;
  header[1] = 0x20;
  header.writeUInt16LE(2100, 2);
  header.writeUInt32LE(data.length, 4);
  header.write(".FIT", 8, "ascii");
  return Buffer.concat([header, data, Buffer.alloc(2)]);
}

/** Zip con un solo file compresso (deflate) */
function buildZip(name: string, content: Buffer) {
  const packed = deflateRawSync(content);
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + nameBuf.length + packed.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBuf.length, 12);
  end.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([local, nameBuf, packed, central, nameBuf, end]);
}

const start = Date.UTC(2026, 9, 31, 7, 0, 0) / 1000;
const points = [0, 1, 2, 40].map((s, i) => ({ t: start + s, lat: 45.4642 + i * 0.0001, lon: 9.19 + i * 0.0001, ele: 120 + i, hr: 140 + i }));

describe("file FIT", () => {
  it("legge i punti della traccia saltando gli altri messaggi", () => {
    const fit = buildFit(points);
    expect(isFit(fit)).toBe(true);
    const records = parseFitRecords(fit);
    expect(records).toHaveLength(4);
    expect(records[0].time).toBe(start);
    expect(records[0].lat).toBeCloseTo(45.4642, 6);
    expect(records[0].lon).toBeCloseTo(9.19, 6);
    expect(records[3].altitude).toBe(123);
    expect(records[3].heartRate).toBe(143);
  });

  it("big endian e timestamp compressi, anche a cavallo dei 32 secondi", () => {
    // Base a 28 s da un multiplo di 32: l'ultimo punto (+10 s) scavalca il giro
    const base = start - ((start - FIT_EPOCH) % 32) + 28;
    const close = [0, 1, 2, 10].map((s, i) => ({ ...points[i], t: base + s }));
    const records = parseFitRecords(buildFit(close, { bigEndian: true, compressed: true }));
    expect(records.map((r) => r.time - base)).toEqual([0, 1, 2, 10]);
    expect(records[2].lat).toBeCloseTo(45.4644, 6);
  });

  it("un file troncato restituisce i punti letti fin lì", () => {
    const fit = buildFit(points);
    expect(parseFitRecords(fit.subarray(0, fit.length - 12)).length).toBeGreaterThanOrEqual(2);
  });

  it("rifiuta ciò che non è un FIT", () => {
    expect(isFit(Buffer.from("<gpx></gpx>"))).toBe(false);
    expect(() => parseFitRecords(Buffer.from("<gpx></gpx>"))).toThrow();
  });
});

describe("zip dell'attività", () => {
  it("estrae il .fit dall'archivio di Garmin", () => {
    const fit = buildFit(points);
    const zip = buildZip("123456_ACTIVITY.fit", fit);
    expect(isZip(zip)).toBe(true);
    const entry = extractEntry(zip, (name) => /\.fit$/i.test(name));
    expect(entry?.name).toBe("123456_ACTIVITY.fit");
    expect(entry?.data.equals(fit)).toBe(true);
    expect(extractEntry(zip, (name) => name.endsWith(".gpx"))).toBeNull();
  });

  it("archivio rovinato: errore leggibile", () => {
    expect(() => extractEntry(Buffer.from("PK\u0003\u0004 rotto"), () => true)).toThrow("zip");
  });
});
