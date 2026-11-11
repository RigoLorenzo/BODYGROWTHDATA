import { describe, expect, it } from "@jest/globals";
import { formatDayIt, localDayKey, localMidnight, resolvePeriod, weekKey, InvalidPeriodError } from "../data/periods";

// Martedì 10 novembre 2026, 23:30 a Roma (22:30 UTC, ora solare)
const NOW = new Date("2026-11-10T22:30:00Z");

describe("localMidnight", () => {
  it("usa l'ora solare d'inverno e legale d'estate", () => {
    expect(localMidnight({ year: 2026, month: 1, day: 1 }).toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(localMidnight({ year: 2026, month: 7, day: 1 }).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });

  it("gestisce il giorno del cambio dell'ora", () => {
    expect(localMidnight({ year: 2026, month: 3, day: 29 }).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(localMidnight({ year: 2026, month: 10, day: 25 }).toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });
});

describe("resolvePeriod", () => {
  it("quest'anno va dal 1° gennaio locale a fine giornata di oggi", () => {
    const p = resolvePeriod({ preset: "this_year" }, NOW, null);
    expect(p.fromDay).toBe("2026-01-01");
    expect(p.toDay).toBe("2026-11-10");
    expect(p.from.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-11-10T23:00:00.000Z");
  });

  it("un allenamento delle 23:30 del 31 dicembre appartiene all'anno vecchio", () => {
    const p = resolvePeriod({ preset: "this_year" }, NOW, null);
    expect(new Date("2025-12-31T22:30:00Z") < p.from).toBe(true);
  });

  it("questa settimana parte dal lunedì", () => {
    const p = resolvePeriod({ preset: "this_week" }, NOW, null);
    expect(p.fromDay).toBe("2026-11-09");
  });

  it("il mese scorso è un mese di calendario completo", () => {
    const p = resolvePeriod({ preset: "last_month" }, NOW, null);
    expect(p.fromDay).toBe("2026-10-01");
    expect(p.toDay).toBe("2026-10-31");
  });

  it("le ultime 4 settimane includono oggi", () => {
    const p = resolvePeriod({ preset: "last_n_weeks", n: 4 }, NOW, null);
    expect(p.fromDay).toBe("2026-10-14");
    expect(p.toDay).toBe("2026-11-10");
  });

  it("da quando usi l'app parte dalla prima seduta", () => {
    const p = resolvePeriod({ preset: "since_start" }, NOW, new Date("2025-12-02T17:00:00Z"));
    expect(p.fromDay).toBe("2025-12-02");
  });

  it("valida i periodi personalizzati", () => {
    const p = resolvePeriod({ preset: "custom", from: "2026-03-01", to: "2026-03-31" }, NOW, null);
    expect(p.label).toBe("dal 1° marzo 2026 al 31 marzo 2026");
    expect(() => resolvePeriod({ preset: "custom", from: "2026-02-30" }, NOW, null)).toThrow(InvalidPeriodError);
    expect(() => resolvePeriod({ preset: "custom", from: "2026-05-01", to: "2026-04-01" }, NOW, null)).toThrow(InvalidPeriodError);
  });
});

describe("chiavi locali", () => {
  it("giorno e settimana nel fuso di Roma", () => {
    expect(localDayKey(NOW)).toBe("2026-11-10");
    expect(localDayKey(new Date("2026-11-10T23:30:00Z"))).toBe("2026-11-11");
    expect(weekKey(new Date("2026-11-15T20:00:00Z"))).toBe("2026-11-09");
  });

  it("formatta le date in italiano", () => {
    expect(formatDayIt("2026-05-01")).toBe("1° maggio 2026");
    expect(formatDayIt("2026-05-12")).toBe("12 maggio 2026");
  });
});
