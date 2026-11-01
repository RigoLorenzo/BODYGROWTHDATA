export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { DEVICES } from "@/lib/devices/registry";
import { DEVICE_PROVIDERS, setWellnessSource, wellnessSourceState } from "@/lib/devices/source";

/** Dispositivi collegati e fonte del benessere */
export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const [statuses, source] = await Promise.all([
    Promise.all(DEVICE_PROVIDERS.map((p) => DEVICES[p].status(userId))),
    wellnessSourceState(userId),
  ]);
  return NextResponse.json({
    devices: DEVICE_PROVIDERS.map((provider, i) => ({
      provider,
      label: DEVICES[provider].label,
      connection: statuses[i],
    })),
    wellnessSource: source.active,
  });
}

const putSchema = z.object({ wellnessSource: z.enum(["MI_FITNESS", "GARMIN"]) });

/** Sceglie da quale dispositivo collegato arriva il benessere */
export async function PUT(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dispositivo non valido" }, { status: 400 });
  const { connected } = await wellnessSourceState(session.user.id);
  if (!connected.includes(parsed.data.wellnessSource)) {
    return NextResponse.json({ error: `${DEVICES[parsed.data.wellnessSource].label} non collegato` }, { status: 409 });
  }
  await setWellnessSource(session.user.id, parsed.data.wellnessSource);
  return NextResponse.json({ wellnessSource: parsed.data.wellnessSource });
}
