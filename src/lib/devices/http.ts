import type { DeviceProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEVICES } from "./registry";

/** Sotto questo intervallo la sincronizzazione automatica non riparte */
const MIN_INTERVAL_MS = 5 * 60_000;

/**
 * POST di sincronizzazione di un dispositivo; `?auto=1` (all'apertura
 * dell'app) rispetta l'intervallo minimo e non insiste con un accesso scaduto.
 */
export async function handleDeviceSync(req: Request, provider: DeviceProvider) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const device = DEVICES[provider];
  const status = await device.status(userId);
  const auto = new URL(req.url).searchParams.get("auto") === "1";
  // La sincronizzazione automatica parte a ogni apertura: senza collegamento non è un errore
  if (!status) {
    return auto
      ? NextResponse.json({ skipped: true, imported: 0, wellness: 0 })
      : NextResponse.json({ error: `${device.label} non collegato` }, { status: 404 });
  }

  const recent = status.lastSyncAt && Date.now() - status.lastSyncAt.getTime() < MIN_INTERVAL_MS;
  if (auto && (recent || status.lastError)) return NextResponse.json({ skipped: true, imported: 0, wellness: 0 });

  try {
    const { imported, wellness } = await device.sync(userId);
    return NextResponse.json({ imported, wellness });
  } catch (error) {
    const reconnect = device.isAuthError(error);
    console.error(`sync ${device.label}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : `Errore ${device.label}`, reconnect },
      { status: reconnect ? 401 : 502 }
    );
  }
}
