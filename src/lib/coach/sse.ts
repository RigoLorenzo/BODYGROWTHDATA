import type { CoachEvent } from "./types";

/**
 * Legge gli eventi "data: {...}" arrivati finora. Un evento può essere
 * spezzato tra due pezzi di rete: la parte incompleta torna in `rest`.
 */
export function parseSse(buffer: string): { events: CoachEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: CoachEvent[] = [];
  for (const part of parts) {
    const data = part
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as CoachEvent);
    } catch {
      // Evento illeggibile: si ignora senza interrompere la risposta
    }
  }
  return { events, rest };
}
