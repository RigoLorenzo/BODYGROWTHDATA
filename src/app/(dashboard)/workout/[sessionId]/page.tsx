import { notFound } from "next/navigation";
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

  return <SessionDetail workout={workout} />;
}
