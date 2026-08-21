export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workouts = await prisma.workoutSession.findMany({
    where: { userId: session.user.id, status: "COMPLETED" },
    orderBy: { startedAt: "asc" },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          exercise: { select: { name: true, nameIt: true, primaryMuscle: true, category: true } },
          sets: { orderBy: { setNumber: "asc" } },
        },
      },
    },
  });

  const rows: string[] = [
    "Date,Session ID,Workout Type,Duration (min),Rest (min),Active (min),Total Volume (kg),Exercise,Esercizio (IT),Set #,Set Type,Weight (kg),Reps,RPE,Volume (kg),Rest after set (s),Notes",
  ];

  for (const workout of workouts) {
    const date = format(workout.startedAt, "yyyy-MM-dd");
    const duration = workout.duration ? Math.round(workout.duration / 60) : "";
    const rest = workout.restSeconds ? Math.round(workout.restSeconds / 60) : "";
    const active = workout.activeSeconds ? Math.round(workout.activeSeconds / 60) : "";
    const head = `${date},${workout.id},${workout.workoutType},${duration},${rest},${active},${workout.totalVolume}`;

    if (workout.exercises.length === 0) {
      // 9 colonne vuote: Exercise → Rest after set
      rows.push([head, ...Array(9).fill(""), `"${workout.notes ?? ""}"`].join(","));
      continue;
    }

    for (const ex of workout.exercises) {
      if (ex.sets.length === 0) {
        // 7 colonne vuote: Set # → Rest after set
        rows.push(
          [head, `"${ex.exercise.name}"`, `"${ex.exercise.nameIt ?? ""}"`, ...Array(7).fill(""), `"${workout.notes ?? ""}"`].join(",")
        );
        continue;
      }
      for (const set of ex.sets) {
        const row = [
          head,
          `"${ex.exercise.name}"`,
          `"${ex.exercise.nameIt ?? ""}"`,
          set.setNumber,
          set.type,
          set.weight ?? "",
          set.reps ?? "",
          set.rpe ?? "",
          set.volume,
          set.restSeconds ?? "",
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
