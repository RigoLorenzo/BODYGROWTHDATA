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
import { WorkoutShareImage } from "@/components/session/share/workout-share-image";
import { WorkoutShareSticker, type StickerInk } from "@/components/session/share/workout-share-sticker";
import {
  shareImageSize,
  type ShareFormat,
  type ShareStyle,
} from "@/components/session/share/share-image-kit";

interface Params { params: Promise<{ sessionId: string }> }

const isShareFormat = (value: string | null): value is ShareFormat =>
  value === "story" || value === "post";

const isShareStyle = (value: string | null): value is ShareStyle =>
  value === "dark" || value === "light" || value === "transparent";

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

/**
 * PNG dell'allenamento da condividere sui social: scheda scura o chiara
 * (storia 9:16 o post 4:5) oppure sticker trasparente da mettere su una foto,
 * con testo bianco o nero (`ink`) a seconda della foto.
 */
export async function GET(req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const formatParam = url.searchParams.get("format");
  const format: ShareFormat = isShareFormat(formatParam) ? formatParam : "story";
  const styleParam = url.searchParams.get("style");
  const style: ShareStyle = isShareStyle(styleParam) ? styleParam : "dark";
  const ink: StickerInk = url.searchParams.get("ink") === "dark" ? "dark" : "light";
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

  const stats = buildWorkoutShareStats(workout);
  const image =
    style === "transparent" ? (
      <WorkoutShareSticker
        ink={ink}
        stats={stats}
        title={title}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        logoSrc={logoSrc}
      />
    ) : (
      <WorkoutShareImage
        format={format}
        variant={style}
        stats={stats}
        title={title}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        athlete={session.user.name ?? null}
        logoSrc={logoSrc}
        domain={new URL(appUrl(req)).host.replace(/^www\./, "")}
      />
    );

  const { width, height } = shareImageSize(style, format);
  return new ImageResponse(image, {
    width,
    height,
    fonts,
    headers: { "Cache-Control": "private, no-store" },
  });
}
