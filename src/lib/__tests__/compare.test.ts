import { describe, expect, it } from "@jest/globals";
import { compareContext, diffTone } from "../compare";

// Martedì 3 novembre 2026
const NOW = new Date(2026, 10, 3, 10, 0);

describe("confronto in parole", () => {
  it("periodo in corso: con il precedente allo stesso punto", () => {
    expect(compareContext("week", NOW, NOW)).toMatchObject({ against: "rispetto alla settimana scorsa, allo stesso giorno", early: false });
    expect(compareContext("year", NOW, NOW)?.against).toBe("rispetto al 2025, alla stessa data");
  });

  it("periodo appena iniziato: il confronto aspetta", () => {
    expect(compareContext("month", NOW, NOW)).toMatchObject({ against: "rispetto a ottobre, allo stesso giorno", early: true });
    expect(compareContext("week", new Date(2026, 10, 2, 9), new Date(2026, 10, 2, 9))?.early).toBe(true);
  });

  it("periodo passato: con il precedente intero; sempre: nessun confronto", () => {
    expect(compareContext("month", new Date(2026, 8, 10), NOW)).toMatchObject({ against: "rispetto ad agosto", early: false });
    expect(compareContext("week", new Date(2026, 9, 20), NOW)?.against).toBe("rispetto alla settimana prima");
    expect(compareContext("all", NOW, NOW)).toBeNull();
  });
});

describe("prima metà del periodo", () => {
  it("il mese al giorno 3 è nella prima metà, al giorno 20 no; i periodi passati mai", () => {
    expect(compareContext("month", NOW, NOW)?.settling).toBe(true);
    const late = new Date(2026, 10, 20, 10);
    expect(compareContext("month", late, late)?.settling).toBe(false);
    expect(compareContext("month", new Date(2026, 8, 10), NOW)?.settling).toBe(false);
  });
});

describe("diffTone: regola unica dei confronti", () => {
  it("senza dati nel periodo prima non confronta", () => {
    expect(diffTone(5, 0)).toBeNull();
  });

  it("il passo senza corse non diventa 'più veloce' (bug −315 sec in verde)", () => {
    expect(diffTone(0, 315, { lowerIsBetter: true })).toBeNull();
    expect(diffTone(300, 315, { lowerIsBetter: true })).toBe("good");
    expect(diffTone(330, 315, { lowerIsBetter: true })).toBe("bad");
  });

  it("nella prima metà del periodo un calo è grigio, un miglioramento resta verde", () => {
    expect(diffTone(0, 5, { settling: true })).toBe("soft");
    expect(diffTone(2, 5, { settling: false })).toBe("bad");
    expect(diffTone(8, 5, { settling: true })).toBe("good");
    expect(diffTone(330, 315, { lowerIsBetter: true, settling: true })).toBe("soft");
  });

  it("valori uguali", () => {
    expect(diffTone(5, 5)).toBe("same");
  });
});
