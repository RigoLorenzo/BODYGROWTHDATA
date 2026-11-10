import { describe, expect, it } from "@jest/globals";
import { blockAt, blocksInRange, buildPlanBlocks, NO_PLAN_ID, UNKNOWN_PLAN_ID } from "../data/plan-blocks";

const d = (iso: string) => new Date(`${iso}T10:00:00Z`);
const s = (iso: string, programId: string | null, programName: string | null = programId) => ({
  startedAt: d(iso),
  programId,
  programName,
});

describe("buildPlanBlocks", () => {
  it("divide la storia quando cambia il piano", () => {
    const blocks = buildPlanBlocks(
      [s("2026-01-05", "a", "Multifrequenza"), s("2026-02-01", "a", "Multifrequenza"), s("2026-05-04", "b", "Upper/Lower"), s("2026-06-01", "b", "Upper/Lower")],
      null
    );
    expect(blocks.map((b) => b.name)).toEqual(["Multifrequenza", "Upper/Lower"]);
    expect(blocks[0].to).toEqual(d("2026-05-04"));
    expect(blocks[1].to).toBeNull();
  });

  it("le sedute libere non interrompono il blocco", () => {
    const blocks = buildPlanBlocks([s("2026-01-05", "a"), s("2026-01-07", null), s("2026-01-09", "a")], null);
    expect(blocks).toHaveLength(1);
  });

  it("le sedute libere prima di ogni piano formano un periodo senza piano", () => {
    const blocks = buildPlanBlocks([s("2025-12-01", null), s("2026-01-05", "a")], null);
    expect(blocks.map((b) => b.programId)).toEqual([NO_PLAN_ID, "a"]);
  });

  it("i giorni di piani eliminati restano un blocco riconoscibile", () => {
    const blocks = buildPlanBlocks([s("2026-01-05", UNKNOWN_PLAN_ID, null), s("2026-03-05", "a")], null);
    expect(blocks[0].name).toBe("Piano precedente (non più disponibile)");
  });

  it("il piano attivo senza sedute è l'ultimo blocco, in corso", () => {
    const blocks = buildPlanBlocks([s("2026-01-05", "a")], { programId: "b", name: "PPL", startedAt: d("2026-10-01") });
    expect(blocks.map((b) => [b.name, b.current])).toEqual([
      ["a", false],
      ["PPL", true],
    ]);
    expect(blocks[0].to).toEqual(d("2026-10-01"));
  });

  it("il piano attivo già in uso segna il blocco come in corso", () => {
    const blocks = buildPlanBlocks([s("2026-01-05", "a")], { programId: "a", name: "a", startedAt: d("2026-01-01") });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].current).toBe(true);
  });

  it("lo stesso piano ripreso più tardi è un blocco nuovo", () => {
    const blocks = buildPlanBlocks([s("2026-01-05", "a"), s("2026-03-05", "b"), s("2026-06-05", "a")], null);
    expect(blocks.map((b) => b.programId)).toEqual(["a", "b", "a"]);
  });
});

describe("ricerca dei blocchi", () => {
  const blocks = buildPlanBlocks([s("2026-01-05", "a"), s("2026-05-04", "b")], null);

  it("trova i blocchi che toccano un periodo", () => {
    expect(blocksInRange(blocks, d("2026-04-01"), d("2026-06-01"))).toHaveLength(2);
    expect(blocksInRange(blocks, d("2026-02-01"), d("2026-03-01"))).toHaveLength(1);
  });

  it("trova il blocco di un istante", () => {
    expect(blockAt(blocks, d("2026-04-30"))?.programId).toBe("a");
    expect(blockAt(blocks, d("2026-05-10"))?.programId).toBe("b");
    expect(blockAt(blocks, d("2025-12-01"))).toBeNull();
  });
});
