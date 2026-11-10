/**
 * Blocchi di allenamento: periodi in cui hai seguito lo stesso piano.
 * Si ricavano dalle sedute (ogni seduta da piano conosce il suo giorno e quindi
 * il piano). Le sedute libere non interrompono un blocco: appartengono al piano
 * che stavi seguendo in quel momento.
 */

export const UNKNOWN_PLAN_ID = "piano-non-disponibile";
export const NO_PLAN_ID = "nessun-piano";

export interface SessionPlanRef {
  startedAt: Date;
  /** null: seduta libera; UNKNOWN_PLAN_ID: giorno del piano non più esistente */
  programId: string | null;
  programName: string | null;
}

export interface PlanBlock {
  /** id del piano, UNKNOWN_PLAN_ID o NO_PLAN_ID */
  programId: string;
  name: string;
  /** inizio del blocco: prima seduta (o attivazione del piano in corso) */
  from: Date;
  /** fine esclusa: inizio del blocco successivo; null per l'ultimo */
  to: Date | null;
  current: boolean;
}

export interface ActivePlanRef {
  programId: string;
  name: string;
  startedAt: Date;
}

const blockName = (ref: Pick<SessionPlanRef, "programId" | "programName">) =>
  ref.programId === UNKNOWN_PLAN_ID ? "Piano precedente (non più disponibile)" : (ref.programName ?? "Piano");

/**
 * Divide la storia in blocchi. `sessions` può essere in qualsiasi ordine.
 * Il piano attivo, se c'è, è sempre l'ultimo blocco (anche senza sedute).
 */
export function buildPlanBlocks(sessions: SessionPlanRef[], active: ActivePlanRef | null): PlanBlock[] {
  const sorted = [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const blocks: PlanBlock[] = [];

  for (const session of sorted) {
    const last = blocks[blocks.length - 1];
    if (session.programId == null) {
      // Seduta libera prima di qualsiasi piano: periodo senza piano
      if (!last) blocks.push({ programId: NO_PLAN_ID, name: "Senza piano", from: session.startedAt, to: null, current: false });
      continue;
    }
    if (last && last.programId === session.programId) continue;
    if (last) last.to = session.startedAt;
    blocks.push({ programId: session.programId, name: blockName(session), from: session.startedAt, to: null, current: false });
  }

  if (active) {
    const last = blocks[blocks.length - 1];
    if (last && last.programId === active.programId) {
      last.current = true;
    } else {
      // Piano attivato dopo l'ultima seduta (o mai usato): blocco in corso
      const from = last && active.startedAt < last.from ? last.from : active.startedAt;
      if (last) last.to = from;
      blocks.push({ programId: active.programId, name: active.name, from, to: null, current: true });
    }
  }

  return blocks;
}

/** Blocchi che si sovrappongono all'intervallo [from, to) */
export function blocksInRange(blocks: PlanBlock[], from: Date, to: Date): PlanBlock[] {
  return blocks.filter((b) => b.from < to && (b.to == null || b.to > from));
}

/** Blocco a cui appartiene un istante (null se precede tutti i blocchi) */
export function blockAt(blocks: PlanBlock[], instant: Date): PlanBlock | null {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].from <= instant) return blocks[i];
  }
  return null;
}

/** Chiave stabile di un blocco (lo stesso piano può tornare in periodi diversi) */
export const blockKey = (block: Pick<PlanBlock, "programId" | "from">) => `${block.programId}@${block.from.toISOString()}`;
