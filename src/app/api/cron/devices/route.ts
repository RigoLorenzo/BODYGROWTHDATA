export const runtime = "nodejs";
export const maxDuration = 300;
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { DEVICES } from "@/lib/devices/registry";
import { DEVICE_PROVIDERS } from "@/lib/devices/source";

/** Tempo per il benessere di tutti i collegamenti, sotto i 300 s della funzione */
const WELLNESS_TOTAL_MS = 200_000;

/** Vercel Cron invia "Authorization: Bearer $CRON_SECRET" */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Aggiornamento giornaliero di ogni dispositivo collegato, anche per chi non apre l'app */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jobs = (
    await Promise.all(DEVICE_PROVIDERS.map(async (p) => (await DEVICES[p].cronUserIds()).map((userId) => ({ provider: p, userId }))))
  ).flat();
  // Nel cron c'è più tempo: lo storico del benessere avanza di più
  const wellnessBudgetMs = Math.max(10_000, Math.floor(WELLNESS_TOTAL_MS / Math.max(1, jobs.length)));
  const synced: Record<string, number> = {};
  for (const { provider, userId } of jobs) {
    try {
      await DEVICES[provider].sync(userId, { wellnessBudgetMs, limitMs: wellnessBudgetMs + 40_000 });
      synced[provider] = (synced[provider] ?? 0) + 1;
    } catch (error) {
      console.error(`cron ${DEVICES[provider].label}`, userId, error);
    }
  }
  return NextResponse.json({ connections: jobs.length, synced });
}
