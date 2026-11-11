export const runtime = "nodejs";
export const maxDuration = 300;
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isCoachConfigured } from "@/lib/coach/access";
import { dailyMessageLimit } from "@/lib/coach/config";
import { coachUser } from "@/lib/coach/guard";
import { coachTurn } from "@/lib/coach/loop";
import { claimTurn, openThread, releaseTurn, ThreadNotFoundError, userMessagesToday } from "@/lib/coach/store";
import type { CoachEvent } from "@/lib/coach/types";

const bodySchema = z.object({
  threadId: z.string().min(1).nullish(),
  text: z.string().trim().min(1).max(4000),
});

/** Una risposta del Coach in streaming (Server-Sent Events) */
export async function POST(req: Request) {
  const guard = await coachUser();
  if ("response" in guard) return guard.response;
  const { userId, level } = guard;

  if (!isCoachConfigured()) {
    return NextResponse.json({ error: "Il Coach non è configurato: manca ANTHROPIC_API_KEY sul server." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Messaggio non valido" }, { status: 400 });

  const now = new Date();
  if ((await userMessagesToday(userId, now)) >= dailyMessageLimit(level)) {
    return NextResponse.json({ error: "Hai raggiunto il limite di messaggi di oggi. Riprova domani." }, { status: 429 });
  }

  let threadId: string;
  try {
    threadId = await openThread(userId, parsed.data.threadId ?? null, parsed.data.text);
  } catch (error) {
    if (error instanceof ThreadNotFoundError) return NextResponse.json({ error: "Conversazione non trovata" }, { status: 404 });
    throw error;
  }
  if (!(await claimTurn(threadId, now))) {
    return NextResponse.json({ error: "Il Coach sta ancora rispondendo in questa conversazione. Attendi la fine." }, { status: 409 });
  }

  const encoder = new TextEncoder();
  // Se l'utente chiude la pagina il turno continua lo stesso: la risposta viene salvata intera
  const send = (controller: ReadableStreamDefaultController, event: CoachEvent) => {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // stream già chiuso dal browser
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, { type: "thread", threadId });
      try {
        for await (const event of coachTurn({ userId, threadId, text: parsed.data.text, now })) send(controller, event);
      } catch (error) {
        console.error("coach turn", error);
        send(controller, { type: "error", message: errorMessage(error) });
      } finally {
        await releaseTurn(threadId).catch((error) => console.error("coach release turn", error));
        try {
          controller.close();
        } catch {
          // già chiuso
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Messaggi d'errore comprensibili, senza dettagli interni */
function errorMessage(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError) return "Il Coach è molto richiesto in questo momento. Riprova tra poco.";
  if (error instanceof Anthropic.AuthenticationError) return "Il Coach non è configurato correttamente (chiave API).";
  if (error instanceof Anthropic.APIConnectionError) return "Non riesco a raggiungere il Coach. Controlla la connessione e riprova.";
  if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) return "Il Coach ha avuto un problema temporaneo. Riprova.";
  return "Qualcosa è andato storto. Riprova.";
}
