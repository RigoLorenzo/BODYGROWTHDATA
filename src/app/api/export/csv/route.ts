export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workouts = await prisma.workoutSession.findMany({
    where: { userId: session.user.id, status: "COMPLETED" },
    orderBy: { startedAt: "asc" },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          exercise: { select: { name: true, primaryMuscle: true, category: true } },
          sets: { orderBy: { setNumber: "asc" } },
        },
      },
    },
  });

  const rows: string[] = [
    "Date,Session ID,Workout Type,Duration (min),Total Volume (kg),Exercise,Set #,Set Type,Weight (kg),Reps,RPE,Volume (kg),Notes",
  ];

  for (const workout of workouts) {
    const date = format(workout.startedAt, "yyyy-MM-dd");
    const duration = workout.duration ? Math.round(workout.duration / 60) : "";

    if (workout.exercises.length === 0) {
      rows.push(`${date},${workout.id},${workout.workoutType},${duration},${workout.totalVolume},,,,,,,"${workout.notes ?? ""}"`);
      continue;
    }

    for (const ex of workout.exercises) {
      if (ex.sets.length === 0) {
        rows.push(`${date},${workout.id},${workout.workoutType},${duration},${workout.totalVolume},${ex.exercise.name},,,,,,"${workout.notes ?? ""}"`);
        continue;
      }
      for (const set of ex.sets) {
        const row = [
          date,
          workout.id,
          workout.workoutType,
          duration,
          workout.totalVolume,
          `"${ex.exercise.name}"`,
          set.setNumber,
          set.type,
          set.weight ?? "",
          set.reps ?? "",
          set.rpe ?? "",
          set.volume,
          `"${set.notes ?? ""}"`,
        ].join(",");
        rows.push(row);
      }
    }
  }

  const csv = rows.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bodygrowth-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  });
}
