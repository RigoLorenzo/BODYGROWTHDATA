import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // Delete in dependency order
  await prisma.$transaction([
    prisma.personalRecord.deleteMany({ where: { userId } }),
    prisma.bodyMeasurement.deleteMany({ where: { userId } }),
    prisma.streak.deleteMany({ where: { userId } }),
    prisma.userAchievement.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.workoutShare.deleteMany({ where: { userId } }),
    prisma.activeProgram.deleteMany({ where: { userId } }),
    prisma.workoutSession.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ success: true });
}
