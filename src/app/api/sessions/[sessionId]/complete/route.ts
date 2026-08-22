export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finalizeSession } from "@/lib/session-manager";

interface Params { params: Promise<{ sessionId: string }> }

interface IncomingSet {
  setNumber: number;
  type?: string;
  weight?: number;
  reps?: number;
  rpe?: number;
  restSeconds?: number;
}

interface IncomingExercise {
  exerciseId: string;
  orderIndex: number;
  restTimerSeconds?: number;
  restAfterSeconds?: number;
  workSeconds?: number;
  sets: IncomingSet[];
}

export async function POST(req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const exercises: IncomingExercise[] = body.exercises ?? [];
    const totalRestSeconds = Number.isFinite(body.totalRestSeconds)
      ? Math.max(0, Math.round(body.totalRestSeconds))
      : 0;

    if (exercises.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Remove any pre-existing exercises (idempotent re-submit)
        await tx.workoutExercise.deleteMany({ where: { sessionId } });

        for (const ex of exercises) {
          const workoutEx = await tx.workoutExercise.create({
            data: {
              sessionId,
              exerciseId: ex.exerciseId,
              orderIndex: ex.orderIndex,
              restTimerSeconds: ex.restTimerSeconds ?? 90,
              restAfterSeconds: ex.restAfterSeconds ?? null,
              workSeconds: ex.workSeconds ?? null,
            },
          });

          for (const s of ex.sets) {
            const weight = s.weight ?? 0;
            const reps = s.reps ?? 0;
            await tx.set.create({
              data: {
                workoutExerciseId: workoutEx.id,
                setNumber: s.setNumber,
                type: (s.type as "WARMUP" | "WORKING" | "DROPSET" | "FAILURE" | "MYOREP") ?? "WORKING",
                weight: weight || null,
                reps: reps || null,
                rpe: s.rpe ?? null,
                restSeconds: s.restSeconds ?? null,
                volume: weight * reps,
              },
            });
          }
        }
      });
    }

    // Deviation tracking: compare actual vs. planned if session was linked to a plan day
    const workoutSession = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      select: { programDayId: true },
    });

    if (workoutSession?.programDayId) {
      const planDay = await prisma.programDay.findUnique({
        where: { id: workoutSession.programDayId },
        include: { exercises: { select: { exerciseId: true } } },
      });
      if (planDay) {
        const plannedIds = new Set(planDay.exercises.map((e) => e.exerciseId));
        const doneIds = new Set(exercises.map((e) => e.exerciseId));
        const missing = Array.from(plannedIds).filter((id) => !doneIds.has(id));
        const extra = Array.from(doneIds).filter((id) => !plannedIds.has(id));
        if (missing.length > 0 || extra.length > 0) {
          const current = await prisma.workoutSession.findUnique({ where: { id: sessionId }, select: { notes: true } });
          const deviationNote = `[DEVIAZIONE: mancanti=${missing.length}, extra=${extra.length}]`;
          await prisma.workoutSession.update({
            where: { id: sessionId },
            data: { notes: current?.notes ? `${current.notes}\n${deviationNote}` : deviationNote },
          });
        }
      }
    }

    await finalizeSession(sessionId, session.user.id, { restSeconds: totalRestSeconds });

    const fullWorkout = await prisma.workoutSession.findUnique({
      where: { id: sessionId },
      include: {
        exercises: {
          include: {
            exercise: true,
            sets: { orderBy: { setNumber: "asc" } },
          },
          orderBy: { orderIndex: "asc" },
        },
        personalRecords: { include: { exercise: true } },
      },
    });
    return NextResponse.json(fullWorkout);
  } catch (err) {
    console.error("complete session error", err);
    return NextResponse.json({ error: "Failed to finalize session" }, { status: 500 });
  }
}
