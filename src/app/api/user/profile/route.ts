export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateProfileSchema = z.object({
  height: z.number().min(100).max(250).optional(),
  weight: z.number().min(30).max(300).optional(),
  experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"]).optional(),
  bio: z.string().max(500).optional(),
});

export async function GET() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(profile ?? {});
}

export async function PATCH(req: Request) {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data = updateProfileSchema.parse(body);

  const profile = await prisma.profile.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });

  return NextResponse.json(profile);
}
