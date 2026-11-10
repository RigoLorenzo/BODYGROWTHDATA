import { describe, expect, it } from "@jest/globals";
import { groupExercises, interleave, linkWithNext, pairFromNotes, unlink, withSupersetTag } from "../superset";

const ex = (id: string, notes?: string) => ({ id, notes, supersetWith: undefined as string | undefined });

describe("superset", () => {
  it("lega un esercizio al successivo e scioglie la coppia", () => {
    const linked = linkWithNext([ex("a"), ex("b"), ex("c")], "a")!;
    expect(linked.map((e) => e.supersetWith)).toEqual(["b", "a", undefined]);
    // Legare b a c scioglie la coppia a-b
    const relinked = linkWithNext(linked, "b")!;
    expect(relinked.map((e) => e.supersetWith)).toEqual([undefined, "c", "b"]);
    expect(unlink(relinked, "c").every((e) => !e.supersetWith)).toBe(true);
    expect(linkWithNext([ex("a")], "a")).toBeNull();
  });

  it("all'avvio riconosce l'etichetta nella nota del primo esercizio", () => {
    // Etichetta su entrambi (come scritto a mano): una coppia sola, la terza resta sola
    const paired = pairFromNotes([ex("a", "Superset · curl"), ex("b", "Superset"), ex("c")]);
    expect(paired.map((e) => e.supersetWith)).toEqual(["b", "a", undefined]);
    // "superset con curl" nel testo libero non è l'etichetta
    expect(pairFromNotes([ex("a", "superset con curl"), ex("b")])[0].supersetWith).toBeUndefined();
  });

  it("raggruppa le coppie e alterna le serie", () => {
    const groups = groupExercises(linkWithNext([ex("a"), ex("b"), ex("c")], "a")!);
    expect(groups.map((g) => g.kind)).toEqual(["superset", "single"]);
    expect(interleave(3, 2)).toEqual([
      { which: 0, index: 0 },
      { which: 1, index: 0 },
      { which: 0, index: 1 },
      { which: 1, index: 1 },
      { which: 0, index: 2 },
    ]);
  });

  it("aggiunge o toglie l'etichetta senza toccare il resto della nota", () => {
    expect(withSupersetTag("presa stretta", true)).toBe("Superset · presa stretta");
    expect(withSupersetTag("Superset · presa stretta", false)).toBe("presa stretta");
    expect(withSupersetTag("Superset", true)).toBe("Superset");
  });
});
