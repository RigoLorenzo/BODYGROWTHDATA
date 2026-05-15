import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [allAchievements, userAchievements] = await Promise.all([
    prisma.achievement.findMany({ orderBy: [{ tier: "asc" }, { xpReward: "asc" }] }),
    prisma.userAchievement.findMany({
      where: { userId: session.user.id },
      include: { achievement: true },
    }),
  ]);

  const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

  const unlocked = userAchievements.map((ua) => ({
    ...ua.achievement,
    completed: ua.completed,
    unlockedAt: ua.unlockedAt,
  }));

  const locked = allAchievements
    .filter((a) => !unlockedIds.has(a.id))
    .map((a) => ({ ...a, completed: false, unlockedAt: null }));

  return NextResponse.json({ unlocked, locked });
}
