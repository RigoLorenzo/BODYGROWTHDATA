import type { RunInput } from "@/lib/run/repository";
import type { FdsContext, SportRecord } from "./client";

/** Tipi di allenamento Mi Fitness importati come corsa */
const RUN_TYPES: Record<number, string> = { 1: "Run", 3: "Treadmill", 5: "TrailRun" };

/** Riepilogo dentro `record.value` (campi usati) */
interface SportReport {
  sport_type?: number;
  proto_type?: number;
  timezone?: number;
  time?: number;
  start_time?: number;
  end_time?: number;
  duration?: number;
  valid_duration?: number;
  distance?: number;
  calories?: number;
  total_cal?: number;
  avg_hrm?: number;
  max_hrm?: number;
  avg_cadence?: number;
  rise_height?: number;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parseReport(record: SportRecord): SportReport {
  try {
    return typeof record.value === "string" ? JSON.parse(record.value) : {};
  } catch {
    return {};
  }
}

/**
 * Identificativo stabile che porta con sé i riferimenti ai file FDS:
 * così la traccia si scarica dopo senza cercare di nuovo l'allenamento.
 */
export const externalIdFor = (ctx: FdsContext) => [ctx.sid, ctx.timestamp, ctx.protoType, ctx.timezone].join("|");

export function parseExternalId(id: string): FdsContext | null {
  const parts = id.split("|");
  if (parts.length < 4) return null;
  const [timezone, protoType, timestamp] = parts.slice(-3).reverse().map(Number);
  const sid = parts.slice(0, -3).join("|");
  return sid && [timezone, protoType, timestamp].every(Number.isFinite) ? { sid, timestamp, protoType, timezone } : null;
}

/** "Corsa mattutina", "Corsa serale"…: l'orologio non dà un nome */
function runName(startedAt: Date, timezoneQuarters: number | null, sportType: string): string {
  if (sportType === "Treadmill") return "Corsa su tapis roulant";
  const hour = (startedAt.getUTCHours() + (timezoneQuarters ?? 4) / 4 + 24) % 24;
  if (hour < 5) return "Corsa notturna";
  if (hour < 12) return "Corsa mattutina";
  if (hour < 18) return "Corsa pomeridiana";
  return "Corsa serale";
}

/** Allenamento Mi Fitness → corsa BodyGrowth (null se non è una corsa) */
export function mapSportRecord(record: SportRecord): RunInput | null {
  const report = parseReport(record);
  const sportType = RUN_TYPES[num(report.sport_type) ?? -1];
  const start = num(report.start_time) ?? num(record.time);
  const distance = num(report.distance);
  if (!sportType || !start || !distance || !record.sid) return null;

  const end = num(report.end_time);
  const duration = num(report.duration) ?? (end ? end - start : null);
  if (!duration || duration <= 0) return null;
  const moving = num(report.valid_duration) || duration;
  const timezone = num(report.timezone);
  const startedAt = new Date(start * 1000);
  const cadence = num(report.avg_cadence);

  return {
    source: "MI_FITNESS",
    externalId: externalIdFor({
      sid: record.sid,
      timestamp: num(report.time) ?? start,
      protoType: num(report.proto_type) ?? num(report.sport_type) ?? 1,
      timezone: timezone ?? 0,
    }),
    name: runName(startedAt, timezone, sportType),
    generatedName: true,
    sportType,
    startedAt,
    distance: Math.round(distance),
    movingTime: Math.round(Math.min(moving, duration)),
    elapsedTime: Math.round(end && end > start ? end - start : duration),
    elevationGain: num(report.rise_height),
    avgHeartRate: num(report.avg_hrm) || null,
    maxHeartRate: num(report.max_hrm) || null,
    avgCadence: cadence ? Math.round(cadence < 120 ? cadence * 2 : cadence) : null,
    calories: num(report.calories) ?? num(report.total_cal),
    // Il tapis roulant non ha GPS: niente da scaricare dopo
    detailed: sportType === "Treadmill",
  };
}
