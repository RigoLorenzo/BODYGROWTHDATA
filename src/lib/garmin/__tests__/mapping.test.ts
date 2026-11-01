import { describe, expect, it } from "@jest/globals";
import { jwtExpiry } from "../client";
import { offsetHour, zoneHour } from "@/lib/wellness/heart";
import { dayOffset, garminTime, isRun, mapActivity, mapDailyHeartRate, mapDailySummary, mapSleep } from "../mapping";

describe("istanti Garmin", () => {
  it("millisecondi, testi numerici, ISO senza fuso (UTC) e { date }", () => {
    const ms = Date.UTC(2026, 9, 31, 6, 30);
    expect(garminTime(ms)).toBe(ms);
    expect(garminTime(String(ms))).toBe(ms);
    expect(garminTime("2026-10-31 06:30:00")).toBe(ms);
    expect(garminTime("2026-10-31T06:30:00.0")).toBe(ms);
    expect(garminTime({ date: "2026-10-31T06:30:00Z" })).toBe(ms);
    expect(garminTime("non una data")).toBeNull();
    expect(garminTime(null)).toBeNull();
  });

  it("scadenza del token dal JWT", () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1_800_000_000 })).toString("base64url");
    expect(jwtExpiry(`h.${payload}.s`)?.getTime()).toBe(1_800_000_000_000);
    expect(jwtExpiry("non-un-jwt")).toBeNull();
  });
});

describe("attività Garmin → corsa", () => {
  const run = {
    activityId: 987654321,
    activityName: "Milano Corsa",
    startTimeGMT: "2026-10-31 06:30:00",
    activityType: { typeId: 1, typeKey: "running", parentTypeId: 17 },
    distance: 10_012.4,
    duration: 3000.5,
    elapsedDuration: 3100,
    movingDuration: 2950,
    elevationGain: 42,
    averageHR: 151,
    maxHR: 178,
    averageRunningCadenceInStepsPerMinute: 171.6,
    calories: 640,
    hasPolyline: true,
  };

  it("corsa all'aperto: da scaricare la traccia", () => {
    expect(mapActivity(run)).toMatchObject({
      source: "GARMIN",
      externalId: "987654321",
      name: "Milano Corsa",
      sportType: "Run",
      startedAt: new Date(Date.UTC(2026, 9, 31, 6, 30)),
      distance: 10_012,
      movingTime: 2950,
      elapsedTime: 3100,
      avgHeartRate: 151,
      avgCadence: 172,
      detailed: false,
    });
  });

  it("tapis roulant e trail dai tipi figli di running", () => {
    const treadmill = mapActivity({ ...run, activityType: { typeId: 18, typeKey: "treadmill_running", parentTypeId: 1 } });
    expect(treadmill).toMatchObject({ sportType: "Treadmill", detailed: true });
    expect(mapActivity({ ...run, activityType: { typeId: 6, typeKey: "trail_running", parentTypeId: 1 } })?.sportType).toBe("TrailRun");
  });

  it("scarta ciò che non è corsa o è incompleto", () => {
    expect(isRun({ typeId: 2, typeKey: "cycling", parentTypeId: 17 })).toBe(false);
    expect(mapActivity({ ...run, activityType: { typeId: 2, typeKey: "cycling", parentTypeId: 17 } })).toBeNull();
    expect(mapActivity({ ...run, distance: 0 })).toBeNull();
    expect(mapActivity({ ...run, startTimeGMT: undefined })).toBeNull();
  });
});

describe("riepilogo giornaliero", () => {
  it("passi, calorie, FC, stress e SpO₂; i valori 'nessun dato' si scartano", () => {
    const day = mapDailySummary({
      calendarDate: "2026-10-30",
      includesWellnessData: true,
      movement: { steps: { value: 11_234, distanceInMeters: 8_765.4 } },
      calories: { burnedActive: 512 },
      heartRate: { minValue: 48, maxValue: 162, restingValue: 52 },
      stress: { avgLevel: 31, maxLevel: -1 },
      pulseOx: { avgValue: 96, minValue: 0 },
    });
    expect(day).toEqual({
      date: "2026-10-30",
      steps: 11_234,
      distance: 8_765,
      activeCalories: 512,
      restingHr: 52,
      minHr: 48,
      maxHr: 162,
      stressAvg: 31,
      spo2Avg: 96,
    });
  });

  it("senza dati dell'orologio non c'è giorno", () => {
    expect(mapDailySummary({ calendarDate: "2026-10-30", includesWellnessData: false })).toBeNull();
    expect(mapDailySummary({ calendarDate: "30/10/2026" })).toBeNull();
  });
});

describe("sonno", () => {
  const start = Date.UTC(2026, 9, 30, 22, 15);
  const end = Date.UTC(2026, 9, 31, 6, 0);

  it("notte con fasi, punteggio e pisolino", () => {
    const [night, nap] = mapSleep({
      id: 77,
      calendarDate: "2026-10-31",
      sleepTimeSeconds: 26_400,
      sleepStartTimestampGMT: start,
      sleepEndTimestampGMT: end,
      deepSleepSeconds: 5_400,
      lightSleepSeconds: 14_400,
      remSleepSeconds: 6_600,
      awakeSleepSeconds: 1_500,
      awakeCount: 2,
      avgHeartRate: 54,
      averageRespirationValue: 14.24,
      sleepScores: { overall: { value: 82 } },
      dailyNapDTOS: [{ napStartTimestampGMT: "2026-10-31 13:00:00", napEndTimestampGMT: "2026-10-31 13:25:00", napTimeSec: 1_380 }],
    });
    expect(night).toMatchObject({
      externalId: "garmin|77",
      date: "2026-10-31",
      duration: 465,
      asleep: 440,
      deep: 90,
      light: 240,
      rem: 110,
      awake: 25,
      score: 82,
      avgHr: 54,
      respRate: 14.2,
      awakeCount: 2,
      isNap: false,
    });
    expect(nap).toMatchObject({ isNap: true, duration: 25, asleep: 23, date: "2026-10-31" });
  });

  it("giorno senza sonno registrato", () => {
    expect(mapSleep({ calendarDate: "2026-10-31", sleepTimeSeconds: 0 })).toEqual([]);
  });
});

describe("battiti al minuto", () => {
  const base = Date.UTC(2026, 9, 30, 23, 0);
  const day = {
    calendarDate: "2026-10-31",
    startTimestampGMT: "2026-10-30T23:00:00.0",
    startTimestampLocal: "2026-10-31T00:00:00.0",
    restingHeartRate: 50,
    heartRateValueDescriptors: [
      { key: "timestamp", index: 0 },
      { key: "heartrate", index: 1 },
    ],
    heartRateValues: [
      [base, 60],
      [base + 120_000, null],
      [base + 3_600_000, 70],
      [base + 3_720_000, 300],
    ],
  };

  it("media, minimo, massimo e curva oraria nell'ora locale", () => {
    expect(dayOffset(day)).toBe(3600);
    const mapped = mapDailyHeartRate(day, offsetHour(3600));
    expect(mapped?.samples).toHaveLength(2);
    expect(mapped?.summary).toEqual({
      date: "2026-10-31",
      restingHr: 50,
      avgHr: 65,
      minHr: 60,
      maxHr: 70,
      hrHourly: [
        { h: 0, avg: 60, min: 60, max: 60 },
        { h: 1, avg: 70, min: 70, max: 70 },
      ],
    });
  });

  it("ora locale dal fuso del profilo, cambio d'ora compreso", () => {
    const rome = zoneHour("Europe/Rome")!;
    expect(rome(Date.UTC(2026, 6, 1, 22, 10) / 1000)).toBe(0);
    expect(rome(Date.UTC(2026, 10, 1, 22, 10) / 1000)).toBe(23);
    expect(zoneHour("Non/Esiste")).toBeNull();
  });
});
