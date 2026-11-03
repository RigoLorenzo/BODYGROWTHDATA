import { describe, expect, it } from "@jest/globals";
import { compareContext } from "../compare";

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
