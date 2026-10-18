import { describe, expect, it } from "@jest/globals";
import {
  byDay,
  consistency,
  monthlySeries,
  periodTotals,
  records,
  timeOfDay,
  totals,
  weekdayStats,
  weeklySeries,
  type ActivityItem,
} from "../insights";

let n = 0;
const gym = (d: Date, minutes: number, volume = 5000, sets = 16): ActivityItem => ({
  id: `g${n++}`,
  startedAt: d,
  kind: "gym",
  duration: minutes * 60,
  volume,
  sets,
  distance: 0,
  title: "Palestra",
});
const run = (d: Date, minutes: number, km: number): ActivityItem => ({
  id: `r${n++}`,
  startedAt: d,
  kind: "run",
  duration: minutes * 60,
  volume: 0,
  sets: 0,
  distance: km * 1000,
  title: "Corsa",
  runId: `run${n}`,
});

// Domenica 18 ottobre 2026, ora locale
const NOW = new Date(2026, 9, 18, 20, 0);
const items: ActivityItem[] = [
  // Settimana 12-18 ottobre: lun, mer, ven sera + sab mattina lungo + corsa dom
  gym(new Date(2026, 9, 12, 18, 30), 60),
  gym(new Date(2026, 9, 14, 19, 0), 65, 6000, 18),
  gym(new Date(2026, 9, 16, 18, 0), 55),
  gym(new Date(2026, 9, 17, 10, 0), 95, 9000, 24),
  run(new Date(2026, 9, 18, 9, 0), 50, 10),
  // Settimana 5-11 ottobre: due sedute e una corsa
  gym(new Date(2026, 9, 5, 18, 0), 60),
  gym(new Date(2026, 9, 7, 18, 0), 60),
  run(new Date(2026, 9, 11, 9, 0), 30, 6),
  // Settembre: una sola seduta
  gym(new Date(2026, 8, 7, 18, 0), 50),
];

describe("insights", () => {
  it("totali: palestra e corsa separate, giorni attivi unici", () => {
    const t = totals(items);
    expect(t).toMatchObject({ sessions: 9, gym: 7, runs: 2, distance: 16_000, activeDays: 9 });
    expect(t.volume).toBe(5000 * 5 + 6000 + 9000);
    expect(t.duration).toBe((60 + 65 + 55 + 95 + 50 + 60 + 60 + 30 + 50) * 60);
  });

  it("periodo in corso e precedente alla stessa data", () => {
    const week = periodTotals(items, "week", NOW);
    expect(week.current.sessions).toBe(5);
    expect(week.previous?.sessions).toBe(3);
    const month = periodTotals(items, "month", NOW);
    expect(month.current.sessions).toBe(8);
    // Settembre fino al 18: solo la seduta del 7
    expect(month.previous?.sessions).toBe(1);
    expect(periodTotals(items, "all", NOW).previous).toBeNull();
  });

  it("giorno della settimana: più sedute e più tempo medio", () => {
    const days = weekdayStats(items);
    expect(days[0]).toMatchObject({ name: "Lunedì", sessions: 3 }); // 12, 5 ott e 7 set
    expect(days[5]).toMatchObject({ name: "Sabato", sessions: 1, avgDuration: 95 * 60 });
    const r = records(items);
    expect(r.favoriteDay?.name).toBe("Lunedì");
    // Sabato (95') ha una sola seduta: troppo poco. Mercoledì: 65' e 60' → 62,5' di media
    expect(r.longestDay?.name).toBe("Mercoledì");
    expect(r.longestDay?.avgDuration).toBe(Math.round(((65 + 60) * 60) / 2));
  });

  it("fasce orarie", () => {
    const slots = timeOfDay(items);
    expect(slots.find((s) => s.key === "evening")?.sessions).toBe(6);
    expect(slots.find((s) => s.key === "morning")?.sessions).toBe(3);
    expect(records(items).favoriteSlot?.label).toBe("Sera");
  });

  it("settimana e mese record, sedute record", () => {
    const r = records(items);
    expect(r.bestWeekSessions?.sessions).toBe(5);
    expect(r.bestWeekSessions?.start.getDate()).toBe(12);
    expect(r.bestWeekDuration?.duration).toBe((60 + 65 + 55 + 95 + 50) * 60);
    expect(r.bestWeekDistance?.distance).toBe(10_000);
    expect(r.bestMonth?.start.getMonth()).toBe(9);
    expect(r.longestSession?.duration).toBe(95 * 60);
    expect(r.heaviestSession?.volume).toBe(9000);
    expect(r.mostSetsSession?.sets).toBe(24);
    expect(r.longestRun?.distance).toBe(10_000);
    expect(r.avgGymDuration).toBe(Math.round(((60 + 65 + 55 + 95 + 60 + 60 + 50) * 60) / 7));
    expect(r.firstDate?.getMonth()).toBe(8);
  });

  it("serie settimanali e mensili dalla più vecchia", () => {
    const weeks = weeklySeries(items, 3, NOW);
    expect(weeks.map((w) => w.sessions)).toEqual([0, 3, 5]);
    expect(weeks[2].start.getDate()).toBe(12);
    const months = monthlySeries(items, 2, NOW);
    expect(months.map((m) => m.sessions)).toEqual([1, 8]);
  });

  it("costanza sulle ultime settimane", () => {
    const c = consistency(items, 6, NOW);
    // 12/10, 5/10 e 7/9 (settimana dal 7/9) attive su 6
    expect(c).toMatchObject({ weeks: 6, activeWeeks: 3, percent: 50 });
    expect(c.avgPerWeek).toBe(1.5);
  });

  it("vuoto: niente record, niente divisioni per zero", () => {
    const r = records([]);
    expect(r.bestWeekSessions).toBeNull();
    expect(r.favoriteDay).toBeNull();
    expect(r.avgGymDuration).toBe(0);
    expect(consistency([], 4, NOW)).toMatchObject({ activeWeeks: 0, percent: 0, avgPerWeek: 0 });
  });

  it("raggruppa per giorno locale", () => {
    const days = byDay(items);
    expect(days.get("2026-10-17")?.[0].duration).toBe(95 * 60);
    expect(days.size).toBe(9);
  });
});
