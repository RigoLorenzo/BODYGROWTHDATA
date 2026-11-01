import { describe, expect, it } from "@jest/globals";
import { externalIdFor, mapOtherSportRecord, mapSportRecord, parseExternalId } from "../mapping";

const record = (report: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  sid: "123456789",
  key: "outdoor_run",
  time: 1_760_770_800,
  value: JSON.stringify(report),
  ...extra,
});

// 18/10/2025 07:00 in Italia (UTC+2 → timezone 8 quarti d'ora)
const OUTDOOR = {
  sport_type: 1,
  proto_type: 1,
  timezone: 8,
  time: 1_760_763_600,
  start_time: 1_760_763_600,
  end_time: 1_760_765_700,
  duration: 2100,
  valid_duration: 2040,
  distance: 6420,
  calories: 410,
  avg_hrm: 151,
  max_hrm: 174,
  avg_cadence: 168,
  rise_height: 38,
};

describe("mappatura Mi Fitness", () => {
  it("corsa all'aperto con riepilogo completo", () => {
    const run = mapSportRecord(record(OUTDOOR))!;
    expect(run).toMatchObject({
      source: "MI_FITNESS",
      name: "Corsa mattutina",
      generatedName: true,
      sportType: "Run",
      distance: 6420,
      movingTime: 2040,
      elapsedTime: 2100,
      elevationGain: 38,
      avgHeartRate: 151,
      maxHeartRate: 174,
      avgCadence: 168,
      calories: 410,
      detailed: false,
    });
    expect(run.startedAt.toISOString()).toBe("2025-10-18T05:00:00.000Z");
    expect(parseExternalId(run.externalId!)).toEqual({ sid: "123456789", timestamp: 1_760_763_600, protoType: 1, timezone: 8 });
  });

  it("tapis roulant: niente traccia da scaricare", () => {
    const run = mapSportRecord(record({ ...OUTDOOR, sport_type: 3, proto_type: 3 }))!;
    expect(run.sportType).toBe("Treadmill");
    expect(run.name).toBe("Corsa su tapis roulant");
    expect(run.detailed).toBe(true);
  });

  it("ignora gli allenamenti che non sono corse o sono incompleti", () => {
    expect(mapSportRecord(record({ ...OUTDOOR, sport_type: 6 }))).toBeNull(); // bici
    expect(mapSportRecord(record({ ...OUTDOOR, distance: 0 }))).toBeNull();
    expect(mapSportRecord(record({ ...OUTDOOR, duration: undefined, end_time: undefined }))).toBeNull();
    expect(mapSportRecord(record(OUTDOOR, { value: "non json" }))).toBeNull();
    expect(mapSportRecord(record(OUTDOOR, { sid: undefined }))).toBeNull();
  });

  it("cadenza di un piede raddoppiata, tempo in movimento mai oltre il totale", () => {
    const run = mapSportRecord(record({ ...OUTDOOR, avg_cadence: 84, valid_duration: 9999 }))!;
    expect(run.avgCadence).toBe(168);
    expect(run.movingTime).toBe(2100);
  });

  it("identificativo reversibile anche con separatori nel sid", () => {
    const ctx = { sid: "a|b", timestamp: 1, protoType: 5, timezone: -20 };
    expect(parseExternalId(externalIdFor(ctx))).toEqual(ctx);
    expect(parseExternalId("solo|due")).toBeNull();
  });
});

describe("allenamenti Mi Fitness che non sono corse", () => {
  const record = (value: object, extra: object = {}) => ({ sid: "watch1", time: 1760551200, value: JSON.stringify(value), ...extra });

  it("forza (308): seduta di palestra senza esercizi", () => {
    // Dal campione del progetto mifit (valori sintetici)
    const gym = mapOtherSportRecord(
      record(
        { sport_type: 308, proto_type: 8, time: 1760551200, timezone: 32, start_time: 1760551200, end_time: 1760552401, duration: 1200, calories: 150, avg_hrm: 110, max_hrm: 140 },
        { key: "strength_training", category: "strength" }
      )
    );
    expect(gym).toMatchObject({
      source: "MI_FITNESS",
      kind: "strength",
      sportType: "Strength",
      title: "Allenamento di forza",
      duration: 1200,
      avgHeartRate: 110,
      calories: 150,
      externalId: "watch1|1760551200|8|32",
    });
  });

  it("bici (6) con distanza; tipo sconosciuto dal nome del record", () => {
    expect(mapOtherSportRecord(record({ sport_type: 6, start_time: 1760551200, duration: 3600, distance: 25_000 }))).toMatchObject({
      kind: "cardio",
      sportType: "Ride",
      distance: 25_000,
    });
    expect(mapOtherSportRecord(record({ sport_type: 999, start_time: 1760551200, duration: 1800 }, { key: "outdoor_walking" }))?.sportType).toBe("Walk");
  });

  it("le corse non passano di qui", () => {
    expect(mapOtherSportRecord(record({ sport_type: 1, start_time: 1760551200, duration: 1800, distance: 5000 }))).toBeNull();
  });
});
