export const runtime = "nodejs";

// Alias for /api/setup-db — seeds exercises and achievements.
// Migrations run at build time via scripts/migrate.mjs (execSync unavailable in serverless).
// POST with header: x-setup-secret: <SETUP_SECRET env var>
import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: Request) {
  const secret = req.headers.get("x-setup-secret");
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
