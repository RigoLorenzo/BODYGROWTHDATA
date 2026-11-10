import { noteHasTag, toggleNoteTag } from "./exercise-notes";

/**
 * Superset: due esercizi consecutivi fatti a serie alternate (A1, B1, A2,
 * B2…). Nel piano si ricorda con l'etichetta "Superset" nella nota del
 * primo esercizio della coppia, così le sedute seguenti lo ripropongono.
 */

export const SUPERSET_TAG = "Superset";

interface Linkable {
  id: string;
  notes?: string;
  /** id dell'altro esercizio della coppia */
  supersetWith?: string;
}

/** Toglie ogni legame che coinvolge gli esercizi indicati */
function clearLinks<T extends Linkable>(exercises: T[], ids: string[]): T[] {
  return exercises.map((ex) =>
    ids.includes(ex.id) || (ex.supersetWith && ids.includes(ex.supersetWith)) ? { ...ex, supersetWith: undefined } : ex
  );
}

/** Lega l'esercizio a quello subito dopo; null se non c'è un esercizio dopo */
export function linkWithNext<T extends Linkable>(exercises: T[], id: string): T[] | null {
  const index = exercises.findIndex((ex) => ex.id === id);
  const next = exercises[index + 1];
  if (index < 0 || !next) return null;
  return clearLinks(exercises, [id, next.id]).map((ex) =>
    ex.id === id ? { ...ex, supersetWith: next.id } : ex.id === next.id ? { ...ex, supersetWith: id } : ex
  );
}

/** Scioglie la coppia di cui fa parte l'esercizio */
export const unlink = <T extends Linkable>(exercises: T[], id: string): T[] => clearLinks(exercises, [id]);

/**
 * All'avvio: ogni esercizio con "Superset" nella nota fa coppia con il
 * successivo (se quello non è già in coppia).
 */
export function pairFromNotes<T extends Linkable>(exercises: T[]): T[] {
  let out = exercises;
  for (let i = 0; i < out.length - 1; i++) {
    const ex = out[i];
    if (ex.supersetWith || !noteHasTag(ex.notes ?? "", SUPERSET_TAG)) continue;
    out = linkWithNext(out, ex.id) ?? out;
    i++; // il successivo ora è in coppia
  }
  return out;
}

export type ExerciseGroup<T> = { kind: "single"; exercise: T } | { kind: "superset"; first: T; second: T };

/** La lista come si mostra: le coppie consecutive diventano un blocco solo */
export function groupExercises<T extends Linkable>(exercises: T[]): ExerciseGroup<T>[] {
  const groups: ExerciseGroup<T>[] = [];
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const next = exercises[i + 1];
    if (next && ex.supersetWith === next.id && next.supersetWith === ex.id) {
      groups.push({ kind: "superset", first: ex, second: next });
      i++;
    } else {
      groups.push({ kind: "single", exercise: ex });
    }
  }
  return groups;
}

/** Ordine delle serie in un superset: A1, B1, A2, B2…; le serie in più restano in fondo */
export function interleave(firstCount: number, secondCount: number): { which: 0 | 1; index: number }[] {
  const rows: { which: 0 | 1; index: number }[] = [];
  for (let i = 0; i < Math.max(firstCount, secondCount); i++) {
    if (i < firstCount) rows.push({ which: 0, index: i });
    if (i < secondCount) rows.push({ which: 1, index: i });
  }
  return rows;
}

/** La nota con o senza l'etichetta "Superset" */
export function withSupersetTag(note: string | undefined, on: boolean): string {
  const text = note ?? "";
  return noteHasTag(text, SUPERSET_TAG) === on ? text : toggleNoteTag(text, SUPERSET_TAG);
}
