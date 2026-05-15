import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { finalizeSession } from "@/lib/session-manager";

interface Params { params: Promise<{ sessionId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await finalizeSession(sessionId, session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Failed to finalize session" }, { status: 500 });
  }
}
