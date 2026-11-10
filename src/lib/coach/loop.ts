import Anthropic from "@anthropic-ai/sdk";
import { anthropic, coachEffort, COACH_BETAS, COACH_MODEL, MAX_OUTPUT_TOKENS, MAX_TOOL_ROUNDS } from "./config";
import { turnContext } from "./context";
import { toApiMessages } from "./history";
import { appendMessage, loadStoredMessages } from "./store";
import { COACH_SYSTEM_PROMPT } from "./system-prompt";
import { executeTool, isCoachTool, toolDefinitions, type ToolContext } from "./tools";
import { toolLabel, type CoachEvent } from "./types";

type Message = Anthropic.Beta.BetaMessage;
type Param = Anthropic.Beta.BetaMessageParam;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;

/** Un input di un tool non leggibile: si ripete la richiesta (massimo 2 volte) */
const MAX_JSON_RETRIES = 2;

/**
 * Un turno del Coach: salva il messaggio dell'utente, poi alterna risposte del
 * modello ed esecuzione dei tool finché il modello ha finito (o chiede
 * qualcosa all'utente). Ogni passaggio è salvato subito, in ordine: lo storico
 * è solo in aggiunta, come richiesto dai blocchi di ragionamento del modello.
 */
export async function* coachTurn(params: { userId: string; threadId: string; text: string; now: Date }): AsyncGenerator<CoachEvent> {
  const { userId, threadId, text, now } = params;
  const ctx: ToolContext = { userId, threadId, now };

  const history = toApiMessages(await loadStoredMessages(threadId));
  const userContent = [{ type: "text" as const, text }];
  const context = await turnContext(userId, now);
  await appendMessage(threadId, "user", userContent);
  await appendMessage(threadId, "system", context);

  const messages: Param[] = [
    ...history,
    { role: "user", content: userContent },
    { role: "system", content: context, clear_at: "next_user_message" },
  ];
  const tools = toolDefinitions();
  let jsonRetries = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let message: Message;
    try {
      const stream = anthropic().beta.messages.stream({
        model: COACH_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        betas: COACH_BETAS,
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: coachEffort() },
        // Istruzioni e tool sono fissi: in cache. Poi si mette in cache anche la conversazione.
        system: [{ type: "text", text: COACH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        cache_control: { type: "ephemeral" },
        tools,
        messages,
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", delta: event.delta.text };
        } else if (event.type === "content_block_start") {
          const block = event.content_block;
          if ((block.type === "tool_use" || block.type === "server_tool_use") && block.name !== "ask_user") {
            yield { type: "tool", name: block.name, label: toolLabel(block.name), status: "start" };
          }
        }
      }
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (error) {
      // Errori dell'API (limiti, autenticazione…): non si riprova qui
      if (error instanceof Anthropic.APIError || jsonRetries >= MAX_JSON_RETRIES) throw error;
      jsonRetries++;
      round--;
      continue;
    }

    await appendMessage(threadId, "assistant", message.content, message.usage);
    messages.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "refusal") {
      yield { type: "text", delta: "\n\nSu questo non posso aiutarti. Se riguarda dolore o salute, senti un medico o un fisioterapista." };
      break;
    }
    // Uno strumento lato server (ricerca web) ha bisogno di continuare
    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter((b): b is ToolUse => b.type === "tool_use");
    if (toolUses.length === 0) break;

    // Un input troncato può sembrare valido: non si esegue nulla
    if (message.stop_reason === "max_tokens") {
      yield { type: "error", message: "La risposta era troppo lunga e si è interrotta. Riprova con una richiesta più mirata." };
      const interrupted = toolUses.map((t) => toolResult(t.id, { error: "Interrotto: risposta troppo lunga." }, true));
      await appendMessage(threadId, "tool", interrupted);
      break;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let endTurn = false;
    for (const use of toolUses) {
      const outcome = await runTool(use, ctx);
      for (const event of outcome.events ?? []) yield event;
      if (use.name !== "ask_user") yield { type: "tool", name: use.name, label: toolLabel(use.name), status: "end" };
      results.push(toolResult(use.id, outcome.result, outcome.isError));
      endTurn ||= Boolean(outcome.endTurn);
    }

    // Tutti i risultati in un solo messaggio, come vuole l'API
    await appendMessage(threadId, "tool", results);
    messages.push({ role: "user", content: results });
    if (endTurn) break;
  }

  yield { type: "done" };
}

async function runTool(use: ToolUse, ctx: ToolContext) {
  if (!isCoachTool(use.name)) return { result: { error: `Tool sconosciuto: ${use.name}` }, isError: true };
  try {
    return await executeTool(use.name, use.input, ctx);
  } catch (error) {
    console.error("coach tool", use.name, error);
    return { result: { error: "Errore interno nel leggere i dati. Riprova o procedi senza questo dato." }, isError: true };
  }
}

function toolResult(id: string, result: unknown, isError?: boolean): Anthropic.Beta.BetaToolResultBlockParam {
  return {
    type: "tool_result",
    tool_use_id: id,
    content: JSON.stringify(result),
    ...(isError ? { is_error: true } : {}),
  };
}
