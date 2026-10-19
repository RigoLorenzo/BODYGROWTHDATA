import { describe, expect, it } from "@jest/globals";
import { HEART_TRACK, LIGHT_TRACK, backwardUnits, coverageDays, forwardUnits } from "../wellness-plan";
import { heartRateBetween } from "../wellness-mapping";

const DAY = 86_400;
const TODAY = Date.UTC(2026, 9, 19) / 1000;
const day = (offset: number) => TODAY + offset * DAY;
const iso = (epoch: number) => new Date(epoch * 1000).toISOString().slice(0, 10);
const show = (units: { from: number; days: number }[]) => units.map((u) => `${iso(u.from)}+${u.days}`);

describe("blocchi del benessere", () => {
  it("prima volta: gli ultimi giorni in un blocco leggero, i battiti un giorno alla volta", () => {
    expect(show(forwardUnits({ from: null, until: null }, LIGHT_TRACK, TODAY))).toEqual(["2026-10-17+3"]);
    expect(show(forwardUnits({ from: null, until: null }, HEART_TRACK, TODAY))).toEqual(["2026-10-18+1", "2026-10-19+1"]);
  });

  it("dopo giorni senza sincronizzare recupera il buco a blocchi, fino a oggi", () => {
    const units = forwardUnits({ from: day(-40), until: day(-13) }, LIGHT_TRACK, TODAY);
    expect(show(units)).toEqual(["2026-10-04+10", "2026-10-14+6"]);
  });

  it("storico a ritroso dal più recente, fermo al limite", () => {
    const light = backwardUnits({ from: day(-2), until: TODAY }, LIGHT_TRACK, TODAY);
    expect(iso(light[0].from)).toBe("2026-10-07");
    expect(iso(light.at(-1)!.from)).toBe(iso(day(-(LIGHT_TRACK.historyDays - 1))));
    expect(light.reduce((s, u) => s + u.days, 0)).toBe(LIGHT_TRACK.historyDays - 3);

    const heart = backwardUnits({ from: day(-1), until: TODAY }, HEART_TRACK, TODAY);
    expect(heart).toHaveLength(HEART_TRACK.historyDays - 2);
    expect(heart.every((u) => u.days === 1)).toBe(true);
    expect(backwardUnits({ from: day(-(LIGHT_TRACK.historyDays - 1)), until: TODAY }, LIGHT_TRACK, TODAY)).toEqual([]);
  });

  it("i battiti si fermano al primo giorno con dati", () => {
    const floor = day(-10);
    const heart = backwardUnits({ from: day(-1), until: TODAY }, HEART_TRACK, TODAY, floor);
    expect(heart).toHaveLength(9);
    expect(iso(heart.at(-1)!.from)).toBe(iso(floor));
  });

  it("avanzamento in giorni coperti", () => {
    expect(coverageDays({ from: null, until: null }, LIGHT_TRACK, TODAY)).toMatchObject({ done: 0, total: 1095, complete: false });
    expect(coverageDays({ from: day(-2), until: TODAY }, LIGHT_TRACK, TODAY)).toMatchObject({ done: 3, since: "2026-10-17" });
    expect(coverageDays({ from: day(-400), until: TODAY }, HEART_TRACK, TODAY)).toMatchObject({ done: 365, complete: true });
    expect(coverageDays({ from: day(-10), until: TODAY }, HEART_TRACK, TODAY, day(-10))).toMatchObject({ done: 11, total: 11, complete: true });
  });

  it("FC tra due istanti solo con abbastanza campioni", () => {
    const samples = Array.from({ length: 12 }, (_, i) => ({ time: 1000 + i * 60, value: 50 + i, offset: 0 }));
    expect(heartRateBetween(samples, 1000, 2000)).toEqual({ avgHr: 56, minHr: 50 });
    expect(heartRateBetween(samples, 1000, 1200)).toBeNull();
  });
});
