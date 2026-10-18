import { describe, expect, it } from "@jest/globals";
import {
  Rc4,
  clientSign,
  decryptFds,
  decryptResponse,
  encryptParams,
  fdsSuffix,
  parseGpsFds,
  parseLoginPayload,
  signedNonce,
} from "../protocol";

/**
 * Vettori generati con pycryptodome (ARC4 drop=1024, AES-CBC), indipendenti
 * da questa implementazione.
 */
const SSECURITY = "AAECAwQFBgcICQoLDA0ODw==";
const NONCE = "ZGVmZ2hpamsBuoFA";
const PATH = "/app/v1/data/get_sport_records_by_time";

describe("protocollo Mi Fitness", () => {
  it("RC4 scarta i primi 1024 byte del keystream", () => {
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(new Rc4(key).apply(Buffer.alloc(16)).toString("hex")).toBe("7fec5bfd9f9b89ce6548309092d7e958");
  });

  it("firma e cifra i parametri come l'app", () => {
    expect(signedNonce(SSECURITY, NONCE)).toBe("uxRcHJ8s4qUXW8PVRWwKDbWWZ3NkD2+u61ZONMGgHXA=");
    const params = encryptParams({
      method: "GET",
      path: PATH,
      params: { data: JSON.stringify({ reverse: true, limit: 20 }) },
      nonce: NONCE,
      ssecurity: SSECURITY,
    });
    expect(params).toEqual({
      data: "GCGjgxSYvpTCRRsqE0fxzaZ44jJDUOr7tx8g",
      rc4_hash__: "SgUUEh4PzcD8WrrbdN3Ii+4XGAh7vVGPSGG3sQ==",
      signature: "iWtY1dqJdEhS7wpQ0YlF+tr7O7E=",
      _nonce: NONCE,
    });
  });

  it("decifra la risposta", () => {
    const body = "GCGyiQaY7t2HVw1+Q0DxkvF4/30QBLPj9l8yDxA9FU8cz+Xaf92pO+DE8YVbRVBvtQmLYlHUtqXs6inoan6Y";
    expect(decryptResponse(body, NONCE, SSECURITY)).toEqual({ code: 0, result: { sport_records: [], has_more: false } });
  });

  it("login: clientSign e prefisso", () => {
    expect(clientSign("123456", SSECURITY)).toBe("+BiLumV3hLGN8TVCix+pXFu0xdQ=");
    expect(parseLoginPayload('&&&START&&&{"code":0,"userId":1}')).toEqual({ code: 0, userId: 1 });
  });

  it("decifra e legge un file GPS FDS (versione 4)", () => {
    const body =
      "jiaY9OsZ1tUViAno6bdi9dB_RlR6pLpHjGhWBerypinGkOA1jx0tqipFnGxmFfqiKfMj6J0yntDqIAB-P-uP7KyqkpV-FYp29pT330f_niw";
    const points = parseGpsFds(decryptFds(body, "ICEiIyQlJicoKSorLC0uLw"));
    expect(points).toHaveLength(2);
    expect(points[0].time).toBe(1_700_000_000);
    expect(points[0].lat).toBeCloseTo(45.43, 4);
    expect(points[0].lon).toBeCloseTo(10.99, 4);
    expect(points[1].altitude).toBeCloseTo(61.5, 3);
    expect(points[1].speed).toBeCloseTo(3.3, 5);
    // Accuratezza marcata non valida nella bitmap: ignorata
    expect(points[0]).not.toHaveProperty("accuracy");
  });

  it("GPS versione 1: senza contatore, record da 12 byte", () => {
    const header = Buffer.from([0, 0, 0, 0, 4, 1, 1, 0, 0b11100000]);
    const rec = Buffer.alloc(12);
    rec.writeUInt32LE(1_700_000_100, 0);
    rec.writeFloatLE(11.5, 4);
    rec.writeFloatLE(46.1, 8);
    const points = parseGpsFds(Buffer.concat([header, rec, rec]));
    expect(points).toHaveLength(2);
    expect(points[0].lon).toBeCloseTo(11.5, 4);
  });

  it("suffisso FDS deterministico e url-safe", () => {
    const suffix = fdsSuffix({ sid: "abc", timestamp: 1_700_000_000, timezone: 8, protoType: 1, fileType: 2 });
    // timestamp LE + tz + (128 + 1<<2 + 2) = 0x86
    expect(suffix.split("_")[0]).toBe(Buffer.from([0x00, 0xf1, 0x53, 0x65, 0x08, 0x86]).toString("base64url"));
    expect(suffix).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
