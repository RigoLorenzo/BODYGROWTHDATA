import { describe, expect, it } from "@jest/globals";
import { parseGpx, gpxName, GpxError } from "../gpx";
import { decodePolyline, encodePolyline } from "../polyline";
import { formatDuration, formatPace, formatKm, parseDuration, paceSecondsPerKm, formatSpeed } from "../format";
import { trimp, fitnessSeries, formLabel } from "../load";
import { personalRecords, totals, weeklyTotals, highlights } from "../stats";

/** Traccia sintetica: verso nord a velocità costante, un punto al secondo */
function syntheticGpx(meters: number, secondsPerKm: number, opts: { hr?: number; climbPerKm?: number } = {}) {
  const speed = 1000 / secondsPerKm; // m/s
  const degPerMeter = 1 / 111_194.9; // latitudine
  const start = Date.parse("2026-10-10T07:00:00Z");
  const pts: string[] = [];
  for (let t = 0; t * speed <= meters; t++) {
    const d = t * speed;
    const ele = 100 + ((opts.climbPerKm ?? 0) * d) / 1000;
    const hr = opts.hr ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${opts.hr}</gpxtpx:hr><gpxtpx:cad>85</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>` : "";
    pts.push(
      `<trkpt lat="${(45 + d * degPerMeter).toFixed(7)}" lon="11.0000000"><ele>${ele.toFixed(1)}</ele><time>${new Date(start + t * 1000).toISOString()}</time>${hr}</trkpt>`
    );
  }
  return `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>Corsa al parco</name><trkseg>${pts.join("")}</trkseg></trk></gpx>`;
}

describe("GPX", () => {
  const xml = syntheticGpx(5200, 300, { hr: 150, climbPerKm: 10 });
  const run = parseGpx(xml);

  it("misura distanza e tempi", () => {
    expect(run.distance).toBeGreaterThan(5180);
    expect(run.distance).toBeLessThan(5220);
    expect(run.movingTime).toBeGreaterThan(1550);
    expect(run.movingTime).toBeLessThan(1570);
    expect(paceSecondsPerKm(run.distance, run.movingTime)).toBeCloseTo(300, -1);
    expect(run.startedAt.toISOString()).toBe("2026-10-10T07:00:00.000Z");
  });

  it("calcola parziali al km, migliori tempi, FC e cadenza", () => {
    expect(run.splits).toHaveLength(6);
    expect(run.splits[0]).toMatchObject({ km: 1, distance: 1000, heartRate: 150 });
    expect(run.splits[0].seconds).toBeGreaterThanOrEqual(299);
    expect(run.splits[0].seconds).toBeLessThanOrEqual(301);
    expect(run.splits[5].distance).toBeLessThan(250);
    const effort = Object.fromEntries(run.bestEfforts.map((e) => [e.name, e.seconds]));
    expect(effort["1 km"]).toBeGreaterThanOrEqual(299);
    expect(effort["5 km"]).toBeGreaterThanOrEqual(1498);
    expect(effort["5 km"]).toBeLessThanOrEqual(1502);
    expect(effort["10 km"]).toBeUndefined();
    expect(run.avgHeartRate).toBe(150);
    expect(run.avgCadence).toBe(170); // 85 per piede → 170 passi/min
  });

  it("calcola il dislivello senza sommare il rumore", () => {
    expect(run.elevationGain).toBeGreaterThan(48);
    expect(run.elevationGain).toBeLessThan(54);
  });

  it("legge il nome e rifiuta file non validi", () => {
    expect(gpxName(xml)).toBe("Corsa al parco");
    expect(() => parseGpx("<html></html>")).toThrow(GpxError);
    expect(() => parseGpx('<gpx><rte><rtept lat="1" lon="1"/></rte></gpx>')).toThrow(GpxError);
  });
});

describe("polyline", () => {
  it("codifica e decodifica il percorso", () => {
    const pts: [number, number][] = [[45.43841, 10.99262], [45.44, 10.99], [45.441, 10.995]];
    const back = decodePolyline(encodePolyline(pts));
    back.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(pts[i][0], 5);
      expect(p[1]).toBeCloseTo(pts[i][1], 5);
    });
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  });
});

describe("formattazione", () => {
  it("ritmo, durata, km, velocità", () => {
    expect(formatPace(312)).toBe(`5'12"`);
    expect(formatPace(null)).toBe("–");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(1505)).toBe("25:05");
    expect(formatKm(10234)).toBe("10,23");
    expect(formatSpeed(10000, 3000)).toBe("12,0");
  });
  it("legge le durate scritte a mano", () => {
    expect(parseDuration("1:02:05")).toBe(3725);
    expect(parseDuration("25:05")).toBe(1505);
    expect(parseDuration("30")).toBe(1800);
    expect(parseDuration("abc")).toBeNull();
  });
});

describe("carico di allenamento", () => {
  it("TRIMP cresce con durata e intensità", () => {
    expect(trimp(3600, 170)).toBeGreaterThan(trimp(3600, 140));
    expect(trimp(3600, 150)).toBeGreaterThan(trimp(1800, 150));
    expect(trimp(1800, null)).toBeGreaterThan(0);
  });
  it("fitness sale lentamente, la fatica in fretta: dopo un blocco la forma è negativa", () => {
    const until = new Date("2026-10-18T12:00:00Z");
    const loads = Array.from({ length: 14 }, (_, i) => ({ date: new Date(until.getTime() - i * 86_400_000), load: 80 }));
    const series = fitnessSeries(loads, 30, until);
    expect(series).toHaveLength(30);
    const last = series[series.length - 1];
    expect(last.fatigue).toBeGreaterThan(last.fitness);
    expect(last.form).toBeLessThan(0);
    expect(formLabel(last.form).tone).not.toBe("fresh");
  });
});

describe("statistiche", () => {
  const runs = [
    { id: "a", startedAt: new Date("2026-10-13T07:00:00Z"), distance: 5000, movingTime: 1500, elevationGain: 20, bestEfforts: [{ name: "5 km", distance: 5000, seconds: 1500 }] },
    { id: "b", startedAt: new Date("2026-10-15T07:00:00Z"), distance: 10000, movingTime: 3200, elevationGain: 40, bestEfforts: [{ name: "5 km", distance: 5000, seconds: 1560 }, { name: "10 km", distance: 10000, seconds: 3200 }] },
    { id: "c", startedAt: new Date("2026-10-01T07:00:00Z"), distance: 3000, movingTime: 960, elevationGain: null, bestEfforts: null },
  ];
  it("totali e ritmo medio", () => {
    const t = totals(runs.slice(0, 2));
    expect(t).toMatchObject({ runs: 2, distance: 15000, movingTime: 4700, elevationGain: 60 });
    expect(Math.round(t.avgPace!)).toBe(313);
  });
  it("km per settimana", () => {
    const weeks = weeklyTotals(runs, 3, new Date("2026-10-18T10:00:00Z"));
    expect(weeks.map((w) => w.distance)).toEqual([3000, 0, 15000]);
  });
  it("record personali e corsa più lunga", () => {
    const prs = personalRecords(runs);
    expect(prs.map((r) => `${r.name}:${r.seconds}:${r.runId}`)).toEqual(["5 km:1500:a", "10 km:3200:b"]);
    expect(highlights(runs).longest?.id).toBe("b");
    expect(highlights(runs).fastest?.id).toBe("a");
  });
});
