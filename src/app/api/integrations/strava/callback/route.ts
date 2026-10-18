export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { verifySignature } from "@/lib/crypto";
import { appUrl } from "@/lib/app-url";
import { connectStrava, syncActivities, STRAVA_SCOPE } from "@/lib/strava";

const STATE_COOKIE = "strava_oauth_state";

/** Ritorno da Strava: verifica lo stato, salva i token e importa le corse */
export async function GET(req: Request) {
  const base = appUrl(req);
  const url = new URL(req.url);
  const done = (status: string, extra = "") => {
    const res = NextResponse.redirect(`${base}/run?strava=${status}${extra}`);
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/integrations/strava" });
    return res;
  };

  const session = await auth().catch(() => null);
  if (!session) return NextResponse.redirect(`${base}/login`);
  if (url.searchParams.get("error")) return done("denied");

  const state = url.searchParams.get("state") ?? "";
  const cookieState = (await cookies()).get(STATE_COOKIE)?.value;
  const [userId, nonce, signature] = state.split(".");
  if (!cookieState || cookieState !== state || userId !== session.user.id || !signature || !verifySignature(`${userId}.${nonce}`, signature)) {
    return done("invalid-state");
  }

  // Senza activity:read_all le corse private non sarebbero leggibili
  const scope = url.searchParams.get("scope");
  if (!scope?.split(",").includes("activity:read_all") && !scope?.split(",").includes("activity:read")) {
    return done("missing-scope");
  }

  const code = url.searchParams.get("code");
  if (!code) return done("error");
  try {
    await connectStrava(session.user.id, code, scope ?? STRAVA_SCOPE);
  } catch (error) {
    console.error("strava callback", error);
    return done("error");
  }
  // Collegato anche se il primo import fallisce (es. limite richieste): si riprova da "Sincronizza"
  try {
    const imported = await syncActivities(session.user.id, { maxPages: 5 });
    return done("connected", `&imported=${imported}`);
  } catch (error) {
    console.error("strava first sync", error);
    return done("sync-failed");
  }
}
