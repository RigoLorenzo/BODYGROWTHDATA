import { encodePolyline, thinPoints } from "./polyline";

/** Punto di una traccia GPS */
export interface TrackPoint {
  lat: number;
  lon: number;
  time: number; // ms
  ele?: number;
  hr?: number;
  cadence?: number;
}

export interface RunSplit {
  km: number;
  /** metri effettivi del parziale (l'ultimo può essere < 1000) */
  distance: number;
  seconds: number;
  elevation?: number;
  heartRate?: number;
}

export interface BestEffort {
  name: string;
  distance: number;
  seconds: number;
}

export interface AnalyzedRun {
  startedAt: Date;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  elevationGain: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  polyline: string | null;
  splits: RunSplit[];
  bestEfforts: BestEffort[];
}

/** Distanze standard per i migliori tempi (come Strava) */
export const BEST_EFFORT_DISTANCES = [
  { name: "1 km", distance: 1000 },
  { name: "1 miglio", distance: 1609.34 },
  { name: "5 km", distance: 5000 },
  { name: "10 km", distance: 10000 },
  { name: "Mezza maratona", distance: 21097.5 },
  { name: "Maratona", distance: 42195 },
];

const EARTH_RADIUS = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sotto questa velocità (m/s) per più di qualche secondo si considera fermo */
const STOPPED_SPEED = 0.6;
/** Rumore del barometro/GPS: le variazioni minori non contano come dislivello */
const ELEVATION_NOISE = 2;

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** Dislivello positivo con isteresi per non sommare il rumore */
function elevationGain(points: TrackPoint[]): number | null {
  const eles = points.map((p) => p.ele).filter((e): e is number => typeof e === "number");
  if (eles.length < 2) return null;
  let gain = 0;
  let ref = eles[0];
  for (const e of eles) {
    if (e - ref >= ELEVATION_NOISE) {
      gain += e - ref;
      ref = e;
    } else if (ref - e >= ELEVATION_NOISE) {
      ref = e;
    }
  }
  return Math.round(gain);
}

/** Tempo per coprire `target` metri dentro la traccia, interpolando */
function timeAt(cumDist: number[], times: number[], target: number): number {
  let lo = 0;
  let hi = cumDist.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumDist[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return times[0];
  const d0 = cumDist[lo - 1];
  const d1 = cumDist[lo];
  const ratio = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
  return times[lo - 1] + ratio * (times[lo] - times[lo - 1]);
}

/** Miglior tempo su una distanza: finestra scorrevole sulla traccia */
function bestEffort(cumDist: number[], times: number[], distance: number): number | null {
  const total = cumDist[cumDist.length - 1];
  if (total < distance) return null;
  let best = Infinity;
  for (let i = 0; i < cumDist.length; i++) {
    const end = cumDist[i] + distance;
    if (end > total) break;
    const t = timeAt(cumDist, times, end) - times[i];
    if (t > 0 && t < best) best = t;
  }
  return Number.isFinite(best) ? Math.round(best) : null;
}

/**
 * Analizza una traccia: distanza, tempo in movimento, dislivello, FC,
 * parziali al km e migliori tempi sulle distanze standard.
 */
export function analyzeTrack(input: TrackPoint[]): AnalyzedRun | null {
  const points = input.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.time));
  points.sort((a, b) => a.time - b.time);
  if (points.length < 2) return null;

  const cumDist = [0];
  const times = [points[0].time / 1000];
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1], points[i]);
    const dt = (points[i].time - points[i - 1].time) / 1000;
    cumDist.push(cumDist[i - 1] + d);
    times.push(points[i].time / 1000);
    if (dt > 0 && d / dt >= STOPPED_SPEED) moving += dt;
  }

  const distance = cumDist[cumDist.length - 1];
  const elapsedTime = Math.round(times[times.length - 1] - times[0]);
  const hrs = points.map((p) => p.hr).filter((h): h is number => typeof h === "number" && h > 0);
  const cads = points.map((p) => p.cadence).filter((c): c is number => typeof c === "number" && c > 0);

  // Parziali al km
  const splits: RunSplit[] = [];
  for (let km = 1; (km - 1) * 1000 < distance; km++) {
    const startD = (km - 1) * 1000;
    const endD = Math.min(km * 1000, distance);
    if (endD - startD < 50) break; // coda trascurabile
    const t0 = timeAt(cumDist, times, startD);
    const t1 = timeAt(cumDist, times, endD);
    const inSplit = points.filter((_, i) => cumDist[i] >= startD && cumDist[i] <= endD);
    const splitHr = mean(inSplit.map((p) => p.hr).filter((h): h is number => typeof h === "number" && h > 0));
    const first = inSplit.find((p) => typeof p.ele === "number")?.ele;
    const last = [...inSplit].reverse().find((p) => typeof p.ele === "number")?.ele;
    splits.push({
      km,
      distance: Math.round(endD - startD),
      seconds: Math.round(t1 - t0),
      ...(first != null && last != null ? { elevation: Math.round(last - first) } : {}),
      ...(splitHr != null ? { heartRate: Math.round(splitHr) } : {}),
    });
  }

  const bestEfforts = BEST_EFFORT_DISTANCES.map(({ name, distance: d }) => {
    const seconds = bestEffort(cumDist, times, d);
    return seconds ? { name, distance: d, seconds } : null;
  }).filter((b): b is BestEffort => !!b);

  const avgCadence = mean(cads);
  return {
    startedAt: new Date(points[0].time),
    distance: Math.round(distance),
    movingTime: Math.round(moving) || elapsedTime,
    elapsedTime,
    elevationGain: elevationGain(points),
    avgHeartRate: hrs.length ? Math.round(mean(hrs)!) : null,
    maxHeartRate: hrs.length ? Math.max(...hrs) : null,
    // Molti dispositivi registrano la cadenza di un piede: la riportiamo a passi/min
    avgCadence: avgCadence == null ? null : Math.round(avgCadence < 120 ? avgCadence * 2 : avgCadence),
    polyline: encodePolyline(thinPoints(points.map((p) => [p.lat, p.lon] as [number, number]), 1500)),
    splits,
    bestEfforts,
  };
}
