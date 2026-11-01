import { inflateRawSync } from "zlib";

/**
 * Estrazione minima da uno zip (l'export originale di Garmin contiene un
 * solo .fit): directory centrale, metodi "stored" e "deflate". Niente zip64,
 * cifratura o archivi multi-disco: non servono per un'attività.
 */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
/** Un .fit di una corsa pesa poche centinaia di KB: oltre è un file sbagliato */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

export const isZip = (buf: Buffer) => buf.length >= 4 && buf.readUInt32LE(0) === LOCAL;

function findEndOfCentralDirectory(buf: Buffer): number {
  const stop = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= stop; i--) if (buf.readUInt32LE(i) === EOCD) return i;
  return -1;
}

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Primo file il cui nome soddisfa `match`; null se non c'è */
export function extractEntry(buf: Buffer, match: (name: string) => boolean): ZipEntry | null {
  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) throw new Error("Archivio zip non valido");
  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== CENTRAL) throw new Error("Archivio zip non valido");
    const method = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const size = buf.readUInt32LE(pos + 24);
    const nameLength = buf.readUInt16LE(pos + 28);
    const extraLength = buf.readUInt16LE(pos + 30);
    const commentLength = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name = buf.toString("utf8", pos + 46, pos + 46 + nameLength);
    pos += 46 + nameLength + extraLength + commentLength;
    if (!match(name)) continue;

    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== LOCAL) throw new Error("Archivio zip non valido");
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(start, start + compressedSize);
    if (raw.length !== compressedSize || size > MAX_ENTRY_BYTES) throw new Error("File nello zip non leggibile");
    if (method === 0) return { name, data: Buffer.from(raw) };
    if (method === 8) return { name, data: inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES }) };
    throw new Error(`Compressione zip non supportata (${method})`);
  }
  return null;
}
