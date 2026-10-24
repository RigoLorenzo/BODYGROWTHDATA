/**
 * Note di un esercizio: restano sul giorno del piano finché non le cambi.
 * Le etichette rapide (superset, drop set…) sono parte del testo.
 */

export const NOTE_MAX = 300;

export const NOTE_TAGS = ["Superset", "Drop set", "Rest-pause", "Fino a cedimento"] as const;

const SEPARATOR = " · ";

const parts = (note: string) =>
  note
    .split(SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);

/** L'etichetta è un pezzo a sé della nota: così toccarla di nuovo la toglie sempre */
const hasTag = (note: string, tag: string) => parts(note).some((p) => p.toLowerCase() === tag.toLowerCase());

/** Nota pulita: spazi ai bordi via, vuota → null, al massimo NOTE_MAX caratteri */
export function cleanNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim().slice(0, NOTE_MAX).trim();
  return trimmed ? trimmed : null;
}

/** true se l'etichetta compare già nella nota */
export const noteHasTag = (note: string, tag: string) => hasTag(note, tag);

/** Aggiunge l'etichetta in testa alla nota, o la toglie se c'è già */
export function toggleNoteTag(note: string, tag: string): string {
  if (!hasTag(note, tag)) return note.trim() ? `${tag}${SEPARATOR}${note.trim()}` : tag;
  return parts(note)
    .filter((p) => p.toLowerCase() !== tag.toLowerCase())
    .join(SEPARATOR);
}
