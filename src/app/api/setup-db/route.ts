export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { seedDatabase } from "@/lib/seed";

// One-time seed endpoint for Vercel first-deploy.
// Call with: POST /api/setup-db  x-setup-secret: <SETUP_SECRET env var>
// Migrations must be run at build time (prisma migrate deploy in build command).
export async function POST(req: Request) {
  const secret = req.headers.get("x-setup-secret");
  if (!secret || secret !== process.env.SETUP_SECRET) {
    const session = await auth().catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedDatabase();
    return NextResponse.json({
      success: true,
      message: `Seeded ${result.exercises} exercises and ${result.achievements} achievements`,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
