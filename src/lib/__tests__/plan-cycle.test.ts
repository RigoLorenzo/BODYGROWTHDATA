import { describe, expect, it } from "@jest/globals";
import { nextCurrentDay, suggestedDayIndex } from "../plan-cycle";

describe("nextCurrentDay", () => {
  it("dopo il giorno consigliato propone il successivo", () => {
    expect(nextCurrentDay(0, 4, 0)).toBe(1);
    expect(suggestedDayIndex(1, 4)).toBe(1);
  });

  it("scegliere un altro giorno sposta il consigliato dopo quello fatto", () => {
    const next = nextCurrentDay(0, 4, 2); // consigliato G1, fatto G3
    expect(suggestedDayIndex(next, 4)).toBe(3); // ora G4
  });

  it("dopo l'ultimo giorno riparte dal primo e conta un nuovo ciclo", () => {
    const next = nextCurrentDay(3, 4, 3);
    expect(next).toBe(4);
    expect(suggestedDayIndex(next, 4)).toBe(0);
  });

  it("ignora indici non validi", () => {
    expect(nextCurrentDay(5, 4, 7)).toBe(5);
    expect(nextCurrentDay(5, 0, 0)).toBe(5);
  });
});
