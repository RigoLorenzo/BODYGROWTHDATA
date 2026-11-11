export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { coachUser } from "@/lib/coach/guard";
import { applyProposal, ProposalAlreadyHandledError, ProposalNotFoundError, rejectProposal } from "@/lib/coach/proposals";
import { InvalidExercisesError } from "@/lib/program-writer";

interface Params { params: Promise<{ id: string }> }

const bodySchema = z.object({ action: z.enum(["apply", "reject"]) });

/** L'utente applica (crea e attiva il piano) o scarta una proposta del Coach */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const guard = await coachUser();
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Azione non valida" }, { status: 400 });

  try {
    if (parsed.data.action === "reject") {
      await rejectProposal(guard.userId, id);
      return NextResponse.json({ status: "rejected" });
    }
    const { programId } = await applyProposal(guard.userId, id);
    return NextResponse.json({ status: "applied", programId });
  } catch (error) {
    if (error instanceof ProposalNotFoundError) return NextResponse.json({ error: "Proposta non trovata" }, { status: 404 });
    if (error instanceof ProposalAlreadyHandledError) return NextResponse.json({ error: "Proposta già gestita" }, { status: 409 });
    if (error instanceof InvalidExercisesError) {
      return NextResponse.json({ error: "Alcuni esercizi non sono più disponibili: chiedi al Coach di rifare la proposta." }, { status: 422 });
    }
    throw error;
  }
}
