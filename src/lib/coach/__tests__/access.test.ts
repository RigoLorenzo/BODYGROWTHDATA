import { afterEach, describe, expect, it } from "@jest/globals";
import { isCoachAdmin, isCoachOwner, levelFrom, parseUserIdList } from "../access-rules";
import { estimateCostUsd } from "../costs";
import { generateInviteCode, normalizeInviteCode } from "../invite-code";

const env = { owners: process.env.COACH_FREE_USER_IDS, admins: process.env.COACH_ADMIN_USER_IDS };
afterEach(() => {
  process.env.COACH_FREE_USER_IDS = env.owners;
  process.env.COACH_ADMIN_USER_IDS = env.admins;
});

describe("accesso al Coach", () => {
  it("legge la lista di id ignorando spazi e voci vuote", () => {
    expect(Array.from(parseUserIdList(" a , b,,c "))).toEqual(["a", "b", "c"]);
    expect(parseUserIdList(undefined).size).toBe(0);
  });

  it("il proprietario viene dalla variabile d'ambiente", () => {
    process.env.COACH_FREE_USER_IDS = "owner-id";
    expect(isCoachOwner("owner-id")).toBe(true);
    expect(isCoachOwner("someone-else")).toBe(false);
    expect(isCoachOwner(null)).toBe(false);
  });

  it("tester solo con un accesso non revocato", () => {
    process.env.COACH_FREE_USER_IDS = "owner-id";
    expect(levelFrom("owner-id", null)).toBe("owner");
    expect(levelFrom("tester", { revokedAt: null })).toBe("tester");
    expect(levelFrom("tester", { revokedAt: new Date() })).toBe("none");
    expect(levelFrom("other", null)).toBe("none");
    expect(levelFrom(null, { revokedAt: null })).toBe("none");
  });

  it("gli admin sono COACH_ADMIN_USER_IDS, altrimenti il proprietario", () => {
    process.env.COACH_FREE_USER_IDS = "owner-id";
    delete process.env.COACH_ADMIN_USER_IDS;
    expect(isCoachAdmin("owner-id")).toBe(true);
    process.env.COACH_ADMIN_USER_IDS = "admin-id";
    expect(isCoachAdmin("owner-id")).toBe(false);
    expect(isCoachAdmin("admin-id")).toBe(true);
  });
});

describe("codici d'invito", () => {
  it("genera codici di 8 caratteri senza simboli ambigui", () => {
    const codes = new Set(Array.from({ length: 200 }, generateInviteCode));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });

  it("accetta minuscole, spazi e trattini, rifiuta il resto", () => {
    expect(normalizeInviteCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeInviteCode(" ab cd ef gh ")).toBe("ABCDEFGH");
    expect(normalizeInviteCode("ABCDEFG0")).toBeNull(); // 0 escluso
    expect(normalizeInviteCode("ABC")).toBeNull();
    expect(normalizeInviteCode("../../x")).toBeNull();
    expect(normalizeInviteCode(42)).toBeNull();
  });
});

describe("costo stimato", () => {
  it("usa i prezzi di Sonnet 5.5", () => {
    // 1M in = 2 $, 100k out = 1 $, 1M cache read = 0,10 $, 100k cache write = 0,25 $
    const cost = estimateCostUsd({
      input_tokens: 1_000_000,
      output_tokens: 100_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 100_000,
    });
    expect(cost).toBeCloseTo(3.35, 5);
  });

  it("ignora valori mancanti o non validi", () => {
    expect(estimateCostUsd(null)).toBe(0);
    expect(estimateCostUsd({ input_tokens: "x", output_tokens: -5 })).toBe(0);
  });
});
