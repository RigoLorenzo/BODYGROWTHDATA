export const runtime = "nodejs";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sign } from "@/lib/crypto";
import { appUrl } from "@/lib/app-url";
import { authorizeUrl, stravaConfig } from "@/lib/strava";

const STATE_COOKIE = "strava_oauth_state";

/** Avvia il collegamento: stato firmato in un cookie contro il CSRF */
export async function GET(req: Request) {
  const session = await auth().catch(() => null);
  const base = appUrl(req);
  if (!session) return NextResponse.redirect(`${base}/login`);
  if (!stravaConfig()) return NextResponse.redirect(`${base}/run?strava=not-configured`);

  const value = `${session.user.id}.${randomBytes(16).toString("base64url")}`;
  const state = `${value}.${sign(value)}`;
  const res = NextResponse.redirect(authorizeUrl(`${base}/api/integrations/strava/callback`, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: base.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/integrations/strava",
  });
  return res;
}
