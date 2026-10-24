import { describe, expect, it } from "@jest/globals";
import { NOTE_MAX, cleanNote, noteHasTag, toggleNoteTag } from "../exercise-notes";

describe("note dell'esercizio", () => {
  it("nota vuota o di soli spazi diventa null, il resto si accorcia", () => {
    expect(cleanNote("  ")).toBeNull();
    expect(cleanNote(undefined)).toBeNull();
    expect(cleanNote("  presa stretta ")).toBe("presa stretta");
    expect(cleanNote("x".repeat(NOTE_MAX + 50))).toHaveLength(NOTE_MAX);
  });

  it("le etichette si aggiungono in testa e si tolgono senza toccare il resto", () => {
    const withTag = toggleNoteTag("Sbarra Batman", "Superset");
    expect(withTag).toBe("Superset · Sbarra Batman");
    expect(noteHasTag(withTag, "superset")).toBe(true);
    expect(toggleNoteTag(withTag, "Superset")).toBe("Sbarra Batman");
    expect(toggleNoteTag("", "Drop set")).toBe("Drop set");
    expect(toggleNoteTag("Drop set", "Drop set")).toBe("");
  });

  it("la parola dentro una frase non è un'etichetta attiva", () => {
    expect(noteHasTag("Sbarra Batman — superset con curl EZ", "Superset")).toBe(false);
  });
});
