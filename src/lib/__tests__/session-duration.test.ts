import { describe, expect, it } from "@jest/globals";
import {
  DEFAULT_DURATION_SECONDS,
  estimateDuration,
  isAbnormalDuration,
  median,
  resolveEndedAt,
  staleSession,
} from "../session-duration";

const MIN = 60;
const HOUR = 3600;

describe("durate anomale", () => {
  it("oltre 4 ore è anomala", () => {
    expect(isAbnormalDuration(41 * HOUR)).toBe(true);
    expect(isAbnormalDuration(3 * HOUR)).toBe(false);
    expect(isAbnormalDuration(null)).toBe(false);
  });

  it("mediana", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(3);
  });
});

describe("estimateDuration", () => {
  const history = [
    { programDayId: "A", duration: 70 * MIN },
    { programDayId: "A", duration: 80 * MIN },
    { programDayId: "A", duration: 41 * HOUR }, // anomala: ignorata
    { programDayId: "B", duration: 50 * MIN },
    { programDayId: null, duration: 5 * MIN }, // troppo corta: ignorata
    { programDayId: null, duration: 60 * MIN },
  ];

  it("usa lo stesso giorno del piano se ci sono almeno due sedute", () => {
    expect(estimateDuration({ programDayId: "A" }, history)).toBe(75 * MIN);
  });

  it("altrimenti tutte le sedute normali", () => {
    expect(estimateDuration({ programDayId: "B" }, history)).toBe(65 * MIN);
    expect(estimateDuration({ programDayId: null }, history)).toBe(65 * MIN);
  });

  it("senza storico: un'ora", () => {
    expect(estimateDuration({ programDayId: "A" }, [])).toBe(DEFAULT_DURATION_SECONDS);
  });
});

describe("staleSession", () => {
  const started = new Date("2026-11-13T17:16:00Z");
  const set = (completedAt?: string, completed = true) => ({ completed, completedAt });

  it("attivo da poco: niente avviso", () => {
    const now = new Date("2026-11-13T18:30:00Z");
    expect(staleSession({ startedAt: started, exercises: [{ sets: [set("2026-11-13T18:20:00Z")] }] }, now)).toBeNull();
  });

  it("fermo da ore: propone di chiudere 3 minuti dopo l'ultima serie", () => {
    const now = new Date("2026-11-15T10:21:00Z");
    const stale = staleSession(
      { startedAt: started, exercises: [{ sets: [set("2026-11-13T18:24:00Z"), set("2026-11-13T18:01:00Z"), set(undefined, false)] }] },
      now
    );
    expect(stale?.suggestedEnd?.toISOString()).toBe("2026-11-13T18:27:00.000Z");
    expect(stale?.hasDoneSets).toBe(true);
  });

  it("nessuna serie fatta: si propone di scartarlo", () => {
    const now = new Date("2026-11-13T19:00:00Z");
    const stale = staleSession({ startedAt: started, exercises: [{ sets: [set(undefined, false)] }] }, now);
    expect(stale).toMatchObject({ hasDoneSets: false, suggestedEnd: null });
  });

  it("serie senza orario (app precedente): nessuna ora proposta", () => {
    const now = new Date("2026-11-14T10:00:00Z");
    expect(staleSession({ startedAt: started, exercises: [{ sets: [set()] }] }, now)).toMatchObject({
      hasDoneSets: true,
      suggestedEnd: null,
    });
  });
});

describe("resolveEndedAt", () => {
  const start = new Date("2026-11-13T17:00:00Z");
  const now = new Date("2026-11-13T20:00:00Z");
  it("accetta un orario tra inizio e adesso", () => {
    expect(resolveEndedAt(start, now, "2026-11-13T18:10:00Z").toISOString()).toBe("2026-11-13T18:10:00.000Z");
  });
  it("rifiuta orari prima dell'inizio o non validi; limita al presente", () => {
    expect(resolveEndedAt(start, now, "2026-11-13T16:00:00Z")).toBe(now);
    expect(resolveEndedAt(start, now, "boh")).toBe(now);
    expect(resolveEndedAt(start, now, "2026-11-14T10:00:00Z").toISOString()).toBe(now.toISOString());
  });
});
