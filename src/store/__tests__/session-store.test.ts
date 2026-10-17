/** @jest-environment jsdom */
import { beforeEach, describe, expect, it } from "@jest/globals";
import { useSessionStore } from "../session-store";

const store = () => useSessionStore.getState();
const sets = () => store().activeSession!.exercises[0].sets;

beforeEach(() => {
  store().startSession({
    id: "s1",
    startedAt: new Date(),
    exercises: [
      {
        id: "ex1",
        exerciseId: "e1",
        exerciseName: "Panca",
        orderIndex: 0,
        restTimerSeconds: 90,
        sets: [1, 2, 3].map((n) => ({ setNumber: n, type: "WORKING" as const, completed: false })),
      },
    ],
  });
});

describe("serie dell'allenamento", () => {
  it("spuntare una serie propone gli stessi valori alla successiva", () => {
    store().updateSet("ex1", 0, { weight: 80, reps: 6 });
    store().completeSet("ex1", 0);
    expect(sets()[0]).toMatchObject({ completed: true, prefilled: false });
    expect(sets()[1]).toMatchObject({ weight: 80, reps: 6, prefilled: true, completed: false });
  });

  it("togliere la spunta rende la serie da fare e non la registra a fine allenamento", () => {
    store().updateSet("ex1", 0, { weight: 80, reps: 6 });
    store().completeSet("ex1", 0);
    store().uncompleteSet("ex1", 0);
    expect(sets()[0]).toMatchObject({ completed: false, prefilled: true });

    store().confirmFilledSets("ex1");
    expect(sets()[0].completed).toBe(false);
  });

  it("le serie compilate a mano ma non spuntate vengono registrate alla fine", () => {
    store().updateSet("ex1", 2, { weight: 70, reps: 10 });
    store().confirmFilledSets("ex1");
    expect(sets()[2].completed).toBe(true);
    expect(sets()[1].completed).toBe(false);
  });

  it("eliminare una serie rinumera le altre", () => {
    store().removeSet("ex1", 0);
    expect(sets().map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it("sostituire un esercizio mantiene posizione e id, cambia esercizio e serie", () => {
    store().replaceExercise("ex1", {
      id: "ignorato",
      exerciseId: "e2",
      exerciseName: "Panca con manubri",
      orderIndex: 0,
      restTimerSeconds: 90,
      sets: [{ setNumber: 1, type: "WORKING", weight: 30, reps: 10, prefilled: true, completed: false }],
    });
    const ex = store().activeSession!.exercises[0];
    expect(ex).toMatchObject({ id: "ex1", exerciseId: "e2", exerciseName: "Panca con manubri" });
    expect(ex.sets).toHaveLength(1);
  });
});
