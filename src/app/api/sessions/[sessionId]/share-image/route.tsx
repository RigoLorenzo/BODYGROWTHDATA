export const runtime = "nodejs";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/app-url";
import { splitDayName } from "@/lib/plan-format";
import { loadShareFonts, loadShareLogo } from "@/lib/share-image-assets";
import {
  buildWorkoutShareStats,
  safeTimeZone,
  timeOfDayTitle,
  zonedDateParts,
} from "@/lib/workout-share";
import {
  SHARE_FORMATS,
  WorkoutShareImage,
  type ShareFormat,
} from "@/components/session/share/workout-share-image";

interface Params { params: Promise<{ sessionId: string }> }

const isShareFormat = (value: string | null): value is ShareFormat =>
  value === "story" || value === "post";

async function workoutTitle(programDayId: string | null, hour: number) {
  if (programDayId) {
    const day = await prisma.programDay.findUnique({
      where: { id: programDayId },
      select: { name: true, dayIndex: true },
    });
    if (day) return splitDayName(day.name, day.dayIndex).title;
  }
  return timeOfDayTitle(hour);
}

/** PNG della scheda allenamento da condividere sui social (storia 9:16 o post 4:5) */
export async function GET(req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const formatParam = url.searchParams.get("format");
  const format: ShareFormat = isShareFormat(formatParam) ? formatParam : "story";
  const timeZone = safeTimeZone(url.searchParams.get("tz"));

  // Solo le sedute dell'utente: l'immagine contiene i suoi dati di allenamento
  const workout = await prisma.workoutSession.findUnique({
    where: { id: sessionId, userId: session.user.id },
    include: {
      exercises: {
        include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
        orderBy: { orderIndex: "asc" },
      },
      personalRecords: { include: { exercise: true } },
    },
  });
  if (!workout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { dateLabel, timeLabel, hour } = zonedDateParts(workout.startedAt, timeZone);
  const [fonts, logoSrc, title] = await Promise.all([
    loadShareFonts(),
    loadShareLogo(),
    workoutTitle(workout.programDayId, hour),
  ]);

  const { width, height } = SHARE_FORMATS[format];
  return new ImageResponse(
    (
      <WorkoutShareImage
        format={format}
        stats={buildWorkoutShareStats(workout)}
        title={title}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        athlete={session.user.name ?? null}
        logoSrc={logoSrc}
        domain={new URL(appUrl(req)).host.replace(/^www\./, "")}
      />
    ),
    {
      width,
      height,
      fonts,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
