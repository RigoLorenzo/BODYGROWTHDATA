import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionDetail } from "@/components/session/session-detail";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function WorkoutDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session) notFound();

  const workout = await prisma.workoutSession.findUnique({
    where: { id: sessionId, userId: session.user.id },
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

  if (!workout) notFound();

  // Le corse hanno la loro pagina, con percorso e parziali
  const run = await prisma.runActivity.findUnique({ where: { sessionId }, select: { id: true } });
  if (run) redirect(`/run/${run.id}`);

  // Titolo come nella scheda condivisa: il giorno del piano, se c'è
  const day = workout.programDayId
    ? await prisma.programDay.findUnique({ where: { id: workout.programDayId }, select: { name: true } })
    : null;

  return <SessionDetail workout={workout} dayName={day?.name ?? null} />;
}
