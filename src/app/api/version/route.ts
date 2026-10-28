import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Versione pubblicata: il client la confronta con quella con cui è stato caricato */
export function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
