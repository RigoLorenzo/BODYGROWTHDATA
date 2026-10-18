export const runtime = "nodejs";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GpxError, gpxName, parseGpx } from "@/lib/run/gpx";
import { saveRun } from "@/lib/run/repository";

const MAX_BYTES = 15 * 1024 * 1024;

/** Import di un file GPX (Strava, Apple Salute, Mi Fitness…) */
export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Nessun file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File troppo grande (max 15 MB)" }, { status: 413 });

  const xml = await file.text();
  try {
    const run = parseGpx(xml);
    // Lo stesso file importato due volte non crea doppioni
    const externalId = createHash("sha256").update(xml).digest("hex").slice(0, 32);
    const saved = await saveRun(session.user.id, {
      source: "GPX",
      externalId,
      name: gpxName(xml) ?? file.name.replace(/\.gpx$/i, "") ?? "Corsa",
      ...run,
      detailed: true,
    });
    return NextResponse.json({ id: saved.id }, { status: 201 });
  } catch (error) {
    if (error instanceof GpxError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
