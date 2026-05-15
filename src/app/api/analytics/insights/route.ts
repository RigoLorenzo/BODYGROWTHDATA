import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateInsights } from "@/lib/insight-engine";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const insights = await generateInsights(session.user.id);
    return NextResponse.json(insights, {
      headers: { "Cache-Control": "private, max-age=900" },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
