import { describe, expect, it } from "@jest/globals";
import {
  dailyRestingHr,
  dailySleeps,
  localParts,
  mapSleepRecord,
  stageMapping,
  summarizeDays,
  withSleepHeartRate,
  zoneOffsetSeconds,
} from "../wellness-mapping";

const ROME = 7200;
// 18/10/2025 00:00 a Roma
const MIDNIGHT = Date.UTC(2025, 9, 17, 22) / 1000;
const at = (hours: number) => MIDNIGHT + hours * 3600;
const rec = (time: number, value: Record<string, unknown>, zone = ROME) => ({ time, zone_offset: zone, value: JSON.stringify(value) });

describe("giorni benessere Mi Fitness", () => {
  it("raggruppa per giorno locale, non UTC", () => {
    // 00:30 a Roma è ancora il 17 in UTC
    expect(localParts(at(0.5), ROME)).toEqual({ date: "2025-10-18", hour: 0 });
    expect(zoneOffsetSeconds({ zone_offset: 8 })).toBe(7200);
    expect(zoneOffsetSeconds({ zone_offset: 3600 })).toBe(3600);
  });

  it("battiti: media, minimo, massimo e curva oraria; scarta i valori impossibili", () => {
    const days = summarizeDays({
      heart_rate: [
        rec(at(3), { bpm: 50 }),
        rec(at(3.5), { bpm: 54 }),
        rec(at(18), { bpm: 150 }),
        rec(at(18.2), { bpm: 0 }),
        rec(at(18.3), { bpm: 300 }),
      ],
    });
    const day = days.get("2025-10-18")!;
    expect(day).toMatchObject({ avgHr: 85, minHr: 50, maxHr: 150 });
    expect(day.hrHourly).toEqual([
      { h: 3, avg: 52, min: 50, max: 54 },
      { h: 18, avg: 150, min: 150, max: 150 },
    ]);
  });

  it("passi sommati, calorie dedicate prioritarie, stress e SpO₂ mediati", () => {
    const day = summarizeDays({
      steps: [rec(at(9), { steps: 4000, distance: 3000, calories: 100 }), rec(at(12), { steps: 2500, distance: 1800, calories: 60 })],
      calories: [rec(at(9), { calories: 220 }), rec(at(20), { calories: 80 })],
      stress: [rec(at(10), { stress: 20 }), rec(at(11), { stress: 60 }), rec(at(12), { stress: 0 })],
      spo2: [rec(at(2), { spo2: 96 }), rec(at(4), { spo2: 93 })],
      resting_heart_rate: [rec(at(8), { bpm: 56, date_time: at(8) })],
    }).get("2025-10-18")!;
    expect(day).toMatchObject({
      steps: 6500,
      distance: 4800,
      activeCalories: 300,
      stressAvg: 40,
      stressMax: 60,
      spo2Avg: 94.5,
      spo2Min: 93,
      restingHr: 56,
    });
  });
});

describe("sonno Mi Fitness", () => {
  const bed = at(-1.5); // 22:30 del 17
  const wake = at(6.5); // 06:30 del 18
  const items = [
    { start_time: bed, end_time: bed + 3600, state: 2 }, // 60 min
    { start_time: bed + 3600, end_time: bed + 3600 * 2.5, state: 1 }, // 90 min
    { start_time: bed + 3600 * 2.5, end_time: bed + 3600 * 7.5, state: 2 }, // 300 min
    { start_time: bed + 3600 * 7.5, end_time: wake - 600, state: 5 }, // 20 min
    { start_time: wake - 600, end_time: wake, state: 4 }, // 10 min
  ];

  it("notte completa con fasi, punteggio e giorno del risveglio", () => {
    const night = mapSleepRecord({
      sid: "watch1",
      time: wake,
      zone_offset: ROME,
      value: JSON.stringify({
        bedtime: bed,
        wake_up_time: wake,
        duration: 480,
        sleep_deep_duration: 90,
        sleep_light_duration: 360,
        sleep_rem_duration: 20,
        sleep_awake_duration: 10,
        sleep_score: 81,
        avg_hr: 52,
        max_hr: 78,
        avg_breath: 14.34,
        awake_count: 3,
        items,
      }),
    })!;
    expect(night).toMatchObject({
      externalId: `watch1|${bed}`,
      date: "2025-10-18",
      duration: 480,
      asleep: 470,
      deep: 90,
      light: 360,
      rem: 20,
      awake: 10,
      score: 81,
      isNap: false,
      avgHr: 52,
      maxHr: 78,
      respRate: 14.3,
      awakeCount: 3,
    });
    expect(night.stages.map((s) => s.stage)).toEqual(["light", "deep", "light", "rem", "awake"]);
  });

  it("i codici di fase si ricavano dai totali se l'orologio li cambia", () => {
    // Codici scambiati: 3 = profondo, 1 = leggero
    const mapping = stageMapping(
      [
        { state: 1, minutes: 300 },
        { state: 3, minutes: 90 },
        { state: 5, minutes: 40 },
      ],
      { deep: 92, light: 298, rem: 41 }
    );
    expect(mapping).toEqual({ 1: "light", 3: "deep", 5: "rem" });
  });

  it("senza totali usa l'ipnogramma; i pisolini di giorno sono riconosciuti", () => {
    const night = mapSleepRecord(rec(wake, { bedtime: bed, wake_up_time: wake, items }))!;
    expect(night).toMatchObject({ deep: 90, light: 360, rem: 20, awake: 10, asleep: 470 });

    const nap = mapSleepRecord(rec(at(15), { bedtime: at(14.5), wake_up_time: at(15) }))!;
    expect(nap).toMatchObject({ isNap: true, duration: 30 });
    expect(mapSleepRecord(rec(wake, { wake_up_time: wake }))).toBeNull();
  });

  it("FC della notte dai campioni al minuto quando manca nel riepilogo", () => {
    const night = mapSleepRecord(rec(wake, { bedtime: bed, wake_up_time: wake }))!;
    const samples = Array.from({ length: 20 }, (_, i) => ({ time: bed + i * 600, value: 48 + (i % 5), offset: ROME }));
    expect(withSleepHeartRate(night, samples)).toMatchObject({ avgHr: 50, minHr: 48 });
    expect(withSleepHeartRate(night, samples.slice(0, 3)).avgHr).toBeNull();
  });
});

describe("riepiloghi giornalieri Mi Fitness", () => {
  // Riga del 24/10/2026: time è la mezzanotte UTC del giorno locale
  const DAY_KEY = Date.UTC(2026, 9, 24) / 1000;
  const bed = Date.UTC(2026, 9, 23, 22, 49) / 1000; // 00:49 a Roma
  const wake = Date.UTC(2026, 9, 24, 6, 8) / 1000; // 08:08 a Roma
  const nap = { bedtime: wake + 6 * 3600, wake_up_time: wake + 6.5 * 3600, duration: 30, timezone: 8 };
  const night = {
    bedtime: bed,
    wake_up_time: wake,
    duration: 439,
    timezone: 8,
    sleep_deep_duration: 167,
    sleep_light_duration: 182,
    sleep_rem_duration: 90,
    sleep_awake_duration: 4,
  };
  const row = (value: Record<string, unknown>) => ({ time: DAY_KEY, sid: "agg", source_sid_list: ["watch1"], value: JSON.stringify(value) });

  it("una notte per sessione, con punteggio e FC del giorno sulla più lunga", () => {
    const sleeps = dailySleeps([row({ sleep_score: 84, avg_hr: 58, total_duration: 469, segment_details: [night, nap] })]);
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toMatchObject({
      externalId: `watch1|${bed}`,
      date: "2026-10-24",
      asleep: 439,
      deep: 167,
      score: 84,
      avgHr: 58,
      isNap: false,
      stages: [],
    });
    expect(sleeps[1]).toMatchObject({ isNap: true, score: null, avgHr: null });
  });

  it("righe senza sessioni o illeggibili non danno notti", () => {
    expect(dailySleeps([row({ total_duration: 0 }), { time: DAY_KEY, value: "non json" }])).toEqual([]);
  });

  it("FC a riposo da avg_rhr, sul giorno locale della riga", () => {
    const days = dailyRestingHr([row({ avg_hr: 70, avg_rhr: 49.6 }), { time: DAY_KEY - 86_400, value: JSON.stringify({ avg_rhr: 0 }) }]);
    expect([...days]).toEqual([["2026-10-24", 50]]);
  });
});
