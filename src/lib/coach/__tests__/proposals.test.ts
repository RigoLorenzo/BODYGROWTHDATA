import { describe, expect, it } from "@jest/globals";
import { checkProposal, estimateDayMinutes, missingBriefSlots, toProgramInput, type ExerciseMeta } from "../proposal-checks";
import type { ProposeProgramInput } from "../tools/schemas";

const meta = new Map<string, ExerciseMeta>([
  ["bench", { id: "bench", name: "Panca piana", primaryMuscle: "CHEST", muscleGroups: ["CHEST"], equipment: ["BARBELL"] }],
  ["row", { id: "row", name: "Rematore", primaryMuscle: "BACK", muscleGroups: ["BACK"], equipment: ["BARBELL"] }],
  ["squat", { id: "squat", name: "Squat", primaryMuscle: "QUADS", muscleGroups: ["QUADS", "GLUTES"], equipment: ["BARBELL"] }],
  ["pushup", { id: "pushup", name: "Piegamenti", primaryMuscle: "CHEST", muscleGroups: ["CHEST"], equipment: ["BODYWEIGHT"] }],
  ["cable", { id: "cable", name: "Croci ai cavi", primaryMuscle: "CHEST", muscleGroups: ["CHEST"], equipment: ["CABLE"] }],
]);

const ex = (exerciseId: string, sets = 3) => ({ exerciseId, sets, repsMin: 8, repsMax: 12, restSeconds: 90 });

const plan = (days: ProposeProgramInput["days"]): ProposeProgramInput => ({
  name: "Test",
  durationWeeks: 8,
  splitType: "FULL_BODY",
  rationale: "perché sì",
  days,
});

const brief = {
  primaryGoal: "ipertrofia",
  daysPerWeek: 2,
  sessionMinutes: 60,
  equipment: ["BARBELL"],
  dislikedExerciseIds: ["row"],
  injuries: [],
};

describe("missingBriefSlots", () => {
  it("chiede tutto se la memoria è vuota", () => {
    expect(missingBriefSlots(null)).toHaveLength(5);
  });

  it("'nessun infortunio' ([]) conta come risposta", () => {
    expect(missingBriefSlots(brief)).toEqual([]);
    expect(missingBriefSlots({ ...brief, injuries: null })).toHaveLength(1);
  });
});

describe("checkProposal", () => {
  it("blocca esercizi da evitare, inesistenti, senza attrezzatura e giorni sbagliati", () => {
    const { errors } = checkProposal(plan([{ name: "A", workoutType: "FULL_BODY", exercises: [ex("row"), ex("ghost"), ex("cable")] }]), brief, meta, "BODYBUILDING");
    expect(errors.join(" ")).toMatch(/Rematore è tra gli esercizi/);
    expect(errors.join(" ")).toMatch(/inesistente/);
    expect(errors.join(" ")).toMatch(/Croci ai cavi richiede /);
    expect(errors.join(" ")).toMatch(/1 giorni ma l'utente si allena 2/);
  });

  it("a corpo libero va sempre bene, e con palestra completa tutto", () => {
    const days = [
      { name: "A", workoutType: "FULL_BODY" as const, exercises: [ex("pushup"), ex("squat")] },
      { name: "B", workoutType: "FULL_BODY" as const, exercises: [ex("cable"), ex("squat")] },
    ];
    expect(checkProposal(plan(days), { ...brief, equipment: ["FULL_GYM"] }, meta, "BODYBUILDING").errors).toEqual([]);
  });

  it("avvisa se la seduta supera il tempo disponibile", () => {
    const long = Array.from({ length: 7 }, () => ex("squat", 5)); // ~91 minuti
    const { warnings } = checkProposal(
      plan([
        { name: "Lunga", workoutType: "LEGS", exercises: long },
        { name: "B", workoutType: "FULL_BODY", exercises: [ex("bench")] },
      ]),
      brief,
      meta,
      "BODYBUILDING"
    );
    expect(warnings.join(" ")).toMatch(/"Lunga" dura circa \d+ minuti/);
  });
});

describe("conversione", () => {
  it("stima la durata della seduta", () => {
    // 3 × (10 × 4 + 90) + 60 = 450 s → 7,5 min + 8 di riscaldamento
    expect(estimateDayMinutes([ex("bench")])).toBe(16);
  });

  it("produce un piano valido per l'app", () => {
    const input = toProgramInput(plan([{ name: "A", workoutType: "FULL_BODY", exercises: [ex("bench")] }]));
    expect(input.frequency).toBe(1);
    expect(input.days[0].exercises[0]).toMatchObject({ exerciseId: "bench", rpe: null, notes: null });
  });
});
