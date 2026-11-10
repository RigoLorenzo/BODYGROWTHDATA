import type Anthropic from "@anthropic-ai/sdk";

/**
 * Storico della conversazione come lo vuole l'API. Nel database ogni messaggio
 * ha un ruolo: user (testo dell'utente), assistant (blocchi completi del
 * modello), system (contesto del turno) e tool (risultati dei tool, che per
 * l'API sono un messaggio "user"). Funzioni pure, testate.
 */

export type StoredRole = "user" | "assistant" | "system" | "tool";

export interface StoredMessage {
  id: string;
  role: string;
  content: unknown;
}

type Param = Anthropic.Beta.BetaMessageParam;
type Block = { type: string; id?: string; tool_use_id?: string };

const blocks = (content: unknown): Block[] => (Array.isArray(content) ? (content as Block[]) : []);

const toParam = (m: StoredMessage): Param | null => {
  switch (m.role) {
    case "user":
    case "tool":
      return { role: "user", content: m.content as Anthropic.Beta.BetaContentBlockParam[] };
    case "assistant":
      return { role: "assistant", content: m.content as Anthropic.Beta.BetaContentBlockParam[] };
    case "system":
      return { role: "system", content: m.content as string, clear_at: "next_user_message" };
    default:
      return null;
  }
};

/**
 * Ricostruisce i messaggi e ripara ciò che un errore a metà turno può aver
 * lasciato: tool senza risultato e contesti di sistema senza risposta.
 * La riparazione è deterministica, quindi ogni richiesta vede lo stesso storico.
 */
export function toApiMessages(stored: StoredMessage[]): Param[] {
  const params = stored.map(toParam).filter((p): p is Param => p !== null);
  const out: Param[] = [];

  for (let i = 0; i < params.length; i++) {
    const message = params[i];
    const next = params[i + 1];

    // Un contesto di sistema deve essere seguito dalla risposta del modello
    if (message.role === "system" && next && next.role !== "assistant") continue;

    out.push(message);

    if (message.role === "assistant") {
      const pending = blocks(message.content)
        .filter((b) => b.type === "tool_use" && b.id)
        .map((b) => b.id!);
      if (pending.length === 0) continue;
      const answered = new Set(
        next && next.role === "user" ? blocks(next.content).filter((b) => b.type === "tool_result").map((b) => b.tool_use_id) : []
      );
      const missing = pending.filter((id) => !answered.has(id));
      if (missing.length > 0) {
        out.push({
          role: "user",
          content: missing.map((id) => ({
            type: "tool_result" as const,
            tool_use_id: id,
            is_error: true,
            content: "Operazione interrotta: non è stata completata.",
          })),
        });
      }
    }
  }
  return out;
}

export interface DisplayAssistant {
  id: string;
  role: "assistant";
  text: string;
  tools: string[];
  questions: unknown[] | null;
  proposalIds: string[];
}

export type DisplayItem = { id: string; role: "user"; text: string } | DisplayAssistant;

const textOf = (content: unknown) =>
  blocks(content)
    .filter((b) => b.type === "text")
    .map((b) => (b as unknown as { text: string }).text)
    .join("");

const proposalIdOf = (content: unknown): string | null => {
  const raw = typeof content === "string" ? content : textOf(content);
  try {
    const parsed = JSON.parse(raw) as { proposalId?: unknown };
    return typeof parsed.proposalId === "string" ? parsed.proposalId : null;
  } catch {
    return null;
  }
};

/** Messaggi per la chat: un turno del Coach (più passaggi) diventa un solo messaggio */
export function toDisplay(stored: StoredMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  const toolNames = new Map<string, string>();
  let current: DisplayAssistant | null = null;

  for (const m of stored) {
    if (m.role === "user") {
      current = null;
      const text = textOf(m.content);
      if (text) items.push({ id: m.id, role: "user", text });
      continue;
    }
    if (m.role === "assistant") {
      if (!current) {
        current = { id: m.id, role: "assistant", text: "", tools: [], questions: null, proposalIds: [] };
        items.push(current);
      }
      const text = textOf(m.content);
      if (text) current.text = current.text ? `${current.text}\n\n${text}` : text;
      for (const b of blocks(m.content)) {
        if ((b.type === "tool_use" || b.type === "server_tool_use") && b.id) {
          const block = b as unknown as { id: string; name: string; input: unknown };
          toolNames.set(block.id, block.name);
          if (!current.tools.includes(block.name)) current.tools.push(block.name);
          if (block.name === "ask_user") {
            const questions = (block.input as { questions?: unknown[] })?.questions;
            if (Array.isArray(questions)) current.questions = questions;
          }
        }
      }
      continue;
    }
    if (m.role === "tool" && current) {
      for (const b of blocks(m.content)) {
        if (b.type !== "tool_result" || !b.tool_use_id || toolNames.get(b.tool_use_id) !== "propose_program") continue;
        const id = proposalIdOf((b as unknown as { content: unknown }).content);
        if (id) current.proposalIds.push(id);
      }
    }
  }
  return items;
}
