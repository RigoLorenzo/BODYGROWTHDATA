import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { InvalidPeriodError, resolvePeriod } from "../data/periods";
import { firstActivity, loadPlanBlocks, loadSessions, searchExercises } from "../data/repository";
import { runTrainingQuery } from "../data/training-query";
import { checkProposal, createProposal, loadExerciseMeta, missingBriefSlots, toView } from "../proposals";
import type { CoachEvent } from "../types";
import { athleteOverview, exerciseHistory, programDetail, recoverySummary } from "./athlete";
import {
  askUserSchema,
  briefSchema,
  emptySchema,
  exerciseHistorySchema,
  getProgramSchema,
  inputSchemaOf,
  proposeProgramSchema,
  recoverySchema,
  searchExercisesSchema,
  trainingQuerySchema,
} from "./schemas";

/**
 * Tool del Coach. L'id utente arriva sempre dalla sessione (ToolContext),
 * mai dal modello: ogni lettura e scrittura è limitata ai suoi dati.
 */

export interface ToolContext {
  userId: string;
  threadId: string;
  now: Date;
}

export interface ToolOutcome {
  result: unknown;
  isError?: boolean;
  events?: CoachEvent[];
  /** Il turno si ferma qui: si aspetta la risposta dell'utente */
  endTurn?: boolean;
}

interface CoachTool<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolOutcome>;
}

const tool = <S extends z.ZodType>(definition: CoachTool<S>) => definition;
const ok = (result: unknown, extra: Omit<ToolOutcome, "result"> = {}): ToolOutcome => ({ result, ...extra });
const fail = (message: string): ToolOutcome => ({ result: { error: message }, isError: true });

const tools = [
  tool({
    name: "get_athlete_overview",
    description:
      "Profilo completo dell'atleta: stile, dati fisici, obiettivi, memoria del Coach (preferenze, infortuni, disponibilità), piano attivo, storia dei piani, ultime 4 settimane, record recenti e cosa manca per creare un piano. Chiamalo all'inizio di ogni conversazione e quando ti serve il quadro generale.",
    schema: emptySchema,
    run: async (_input, ctx) => ok(await athleteOverview(ctx.userId, ctx.now)),
  }),
  tool({
    name: "get_program",
    description: "Il piano attivo (o un piano dell'utente per id) con giorni, esercizi e id, serie, ripetizioni, RPE e recuperi.",
    schema: getProgramSchema,
    run: async (input, ctx) => ok(await programDetail(ctx.userId, input.programId)),
  }),
  tool({
    name: "query_training_data",
    description:
      "Calcola qualsiasi numero sugli allenamenti dell'utente: allenamenti, serie (anche per muscolo, dirette e indirette), ripetizioni, volume, ore, serie più pesante e massimale stimato per esercizio, km, tempo e passo di corsa. Usalo SEMPRE per rispondere a domande con numeri: non stimare e non fare conti a mano. Il risultato riporta il periodo interpretato, il dettaglio per piano seguito (plans) e cosa manca nei dati (coverage).",
    schema: trainingQuerySchema,
    run: async (input, ctx) => {
      if ((input.metric === "e1rm" || input.metric === "max_weight") && input.exerciseIds.length === 0 && input.groupBy !== "exercise") {
        return fail("Per max_weight ed e1rm indica exerciseIds (da search_exercises) oppure groupBy 'exercise'.");
      }
      const first = await firstActivity(ctx.userId);
      let period;
      try {
        period = resolvePeriod(input.period, ctx.now, first);
      } catch (error) {
        if (error instanceof InvalidPeriodError) return fail(error.message);
        throw error;
      }
      const [blocks, sessions] = await Promise.all([loadPlanBlocks(ctx.userId), loadSessions(ctx.userId, period.from, period.to)]);
      return ok(runTrainingQuery(sessions, input, { period, firstActivity: first, now: ctx.now, blocks }));
    },
  }),
  tool({
    name: "get_exercise_history",
    description: "Le ultime sedute di un esercizio con tutte le serie (peso × ripetizioni, RPE) e il massimale stimato di ciascuna.",
    schema: exerciseHistorySchema,
    run: async (input, ctx) => ok(await exerciseHistory(ctx.userId, input.exerciseId, input.lastSessions)),
  }),
  tool({
    name: "get_recovery_summary",
    description:
      "Sonno, battito a riposo, stress e passi degli ultimi giorni dall'orologio collegato, con l'andamento. Usalo per valutare recupero e carico.",
    schema: recoverySchema,
    run: async (input, ctx) => ok(await recoverySummary(ctx.userId, input.days, ctx.now)),
  }),
  tool({
    name: "search_exercises",
    description:
      "Cerca esercizi nella libreria dell'app e tra quelli personalizzati dell'utente, per nome, muscolo o attrezzatura. Restituisce gli id da usare in query_training_data e propose_program.",
    schema: searchExercisesSchema,
    run: async (input, ctx) => {
      const rows = await searchExercises(ctx.userId, input);
      return ok(rows.map((r) => ({ ...r, name: r.nameIt ?? r.name, englishName: r.name, nameIt: undefined })));
    },
  }),
  tool({
    name: "update_athlete_brief",
    description:
      "Salva nella memoria del Coach ciò che l'utente ti dice di sé: obiettivo, giorni e durata disponibili, attrezzatura, esercizi graditi o da evitare, infortuni, note. Chiamalo appena ricevi queste informazioni. Le liste sostituiscono quelle salvate: invia sempre la lista completa aggiornata.",
    schema: briefSchema,
    run: async (input, ctx) => {
      const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
      const fields = Object.keys(data);
      if (fields.length === 0) return fail("Nessun campo da salvare.");
      const brief = await prisma.athleteBrief.upsert({
        where: { userId: ctx.userId },
        update: data,
        create: { userId: ctx.userId, ...data },
      });
      return ok({ saved: fields, missingForNewPlan: missingBriefSlots(brief) }, { events: [{ type: "memory", fields }] });
    },
  }),
  tool({
    name: "ask_user",
    description:
      "Fai all'utente da 1 a 4 domande con risposte rapide da toccare. Usalo quando ti mancano informazioni per fare bene il tuo lavoro (es. giorni, durata, attrezzatura, preferenze, infortuni). Dopo questo tool il turno finisce: la risposta arriva nel messaggio successivo. Non ripetere le domande nel testo.",
    schema: askUserSchema,
    run: async (input) =>
      ok(
        { shown: true, note: "Domande mostrate all'utente: la risposta arriverà nel prossimo messaggio." },
        { events: [{ type: "ask_user", questions: input.questions }], endTurn: true }
      ),
  }),
  tool({
    name: "propose_program",
    description:
      "Propone un nuovo piano di allenamento completo. L'utente lo vede come anteprima e lo attiva solo toccando 'Applica'. Prima servono obiettivo, giorni a settimana, durata della seduta, attrezzatura e infortuni nella memoria (update_athlete_brief); gli esercizi devono avere id presi da search_exercises. Se la risposta contiene errori, correggi e riprova.",
    schema: proposeProgramSchema,
    run: async (input, ctx) => {
      const [brief, user] = await Promise.all([
        prisma.athleteBrief.findUnique({ where: { userId: ctx.userId } }),
        prisma.user.findUnique({ where: { id: ctx.userId }, select: { trainingStyle: true } }),
      ]);
      const missing = missingBriefSlots(brief);
      if (missing.length > 0) {
        return fail(`Prima di proporre un piano chiedi all'utente (ask_user) e salva (update_athlete_brief): ${missing.join("; ")}.`);
      }
      const ids = Array.from(new Set(input.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
      const meta = await loadExerciseMeta(ctx.userId, ids);
      const { errors, warnings } = checkProposal(input, brief, meta, user?.trainingStyle ?? null);
      if (errors.length > 0) return fail(`Piano non valido, correggi: ${errors.join(" ")}`);

      const proposal = await createProposal(ctx.userId, ctx.threadId, input, warnings);
      return ok(
        {
          proposalId: proposal.id,
          warnings,
          note: "L'utente vede l'anteprima con il pulsante Applica. Il piano NON è ancora attivo: riassumilo in breve e invitalo a guardarlo.",
        },
        { events: [{ type: "proposal", proposal: toView(proposal, meta) }] }
      );
    },
  }),
];

const byName = new Map<string, (typeof tools)[number]>(tools.map((t) => [t.name, t]));

/** Fonti affidabili per le domande di approfondimento */
const WEB_DOMAINS = [
  "pubmed.ncbi.nlm.nih.gov",
  "pmc.ncbi.nlm.nih.gov",
  "strongerbyscience.com",
  "nsca.com",
  "acsm.org",
  "bjsm.bmj.com",
];

/** Definizioni inviate all'API: ordine stabile, così la cache del prompt regge */
export function toolDefinitions(): Anthropic.Beta.BetaToolUnion[] {
  const custom: Anthropic.Beta.BetaToolUnion[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: inputSchemaOf(t.schema),
    // Gli input arrivano mentre vengono generati: si validano qui prima di eseguirli
    eager_input_streaming: true,
  }));
  return [...custom, { type: "web_search_20260209", name: "web_search", max_uses: 3, allowed_domains: WEB_DOMAINS }];
}

export const isCoachTool = (name: string) => byName.has(name);

/** Valida ed esegue un tool. Un input non valido torna al modello come errore. */
export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const definition = byName.get(name);
  if (!definition) return fail(`Tool sconosciuto: ${name}`);
  const parsed = definition.schema.safeParse(input);
  if (!parsed.success) {
    return fail(`Input non valido: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`);
  }
  // Ogni tool ha il suo schema: il cast è sicuro dopo la validazione
  return (definition.run as (input: unknown, ctx: ToolContext) => Promise<ToolOutcome>)(parsed.data, ctx);
}
