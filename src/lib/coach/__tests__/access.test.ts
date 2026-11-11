import { afterEach, describe, expect, it } from "@jest/globals";
import { hasCoachAccess, parseUserIdList } from "../access";

const original = process.env.COACH_FREE_USER_IDS;
afterEach(() => {
  process.env.COACH_FREE_USER_IDS = original;
});

describe("accesso al Coach", () => {
  it("legge la lista di id ignorando spazi e voci vuote", () => {
    expect(Array.from(parseUserIdList(" a , b,,c "))).toEqual(["a", "b", "c"]);
    expect(parseUserIdList(undefined).size).toBe(0);
  });

  it("solo gli utenti nella lista possono usarlo", () => {
    process.env.COACH_FREE_USER_IDS = "owner-id";
    expect(hasCoachAccess("owner-id")).toBe(true);
    expect(hasCoachAccess("someone-else")).toBe(false);
    expect(hasCoachAccess(null)).toBe(false);
  });

  it("senza lista nessuno ha accesso", () => {
    delete process.env.COACH_FREE_USER_IDS;
    expect(hasCoachAccess("owner-id")).toBe(false);
  });
});
