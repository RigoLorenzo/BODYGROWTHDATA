export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { startQrLogin } from "@/lib/mifitness/client";
import { QR_COOKIE, QR_COOKIE_PATH } from "@/lib/mifitness/qr-cookie";

/**
 * Avvia l'accesso Xiaomi: QR da scansionare o link da aprire. L'indirizzo di
 * attesa resta sul server in un cookie cifrato e legato all'utente.
 */
export async function POST() {
  const session = await auth().catch(() => null);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const qr = await startQrLogin();
    const state = { lp: qr.lp, uid: session.user.id, exp: Date.now() + qr.expiresIn * 1000 };
    const res = NextResponse.json({ qrImage: qr.qrImage, loginUrl: qr.loginUrl, expiresIn: qr.expiresIn });
    res.cookies.set(QR_COOKIE, encryptSecret(JSON.stringify(state)), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: QR_COOKIE_PATH,
      maxAge: qr.expiresIn,
    });
    return res;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Xiaomi non raggiungibile" }, { status: 502 });
  }
}
