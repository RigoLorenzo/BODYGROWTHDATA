export const runtime = "nodejs";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { pollQrLogin } from "@/lib/mifitness/client";
import { QR_COOKIE, QR_COOKIE_PATH } from "@/lib/mifitness/qr-cookie";
import { connectMiFitness, syncMiFitness } from "@/lib/mifitness/sync";

/** Attesa massima per richiesta: il client richiama finché non confermi */
const WAIT_MS = 20_000;

interface QrState {
  lp: string;
  uid: string;
  exp: number;
}

async function readState(): Promise<QrState | null> {
  const raw = (await cookies()).get(QR_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decryptSecret(raw)) as QrState;
  } catch {
    return null;
  }
}

export async function POST() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = await readState();
  if (!state || state.uid !== session.user.id || state.exp < Date.now()) {
    return NextResponse.json({ status: "expired" });
  }

  const result = await pollQrLogin(state.lp, WAIT_MS);
  if (result.status === "waiting") return NextResponse.json({ status: "waiting" });

  const done = (body: object, status = 200) => {
    const res = NextResponse.json(body, { status });
    res.cookies.delete({ name: QR_COOKIE, path: QR_COOKIE_PATH });
    return res;
  };
  try {
    await connectMiFitness(session.user.id, result.userId, result.passToken);
  } catch (error) {
    return done({ status: "error", error: error instanceof Error ? error.message : "Collegamento non riuscito" }, 502);
  }
  const imported = await syncMiFitness(session.user.id).catch(() => null);
  return done({ status: "connected", imported });
}
