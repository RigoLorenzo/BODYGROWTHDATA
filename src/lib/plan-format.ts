/** "G2 — Gambe A · Deltoidi" → { code: "G2", title: "Gambe A · Deltoidi" } */
export function splitDayName(name: string, index: number) {
  const [head, ...rest] = name.split(" — ");
  if (rest.length && head.length <= 4) return { code: head, title: rest.join(" — ") };
  return { code: `G${index + 1}`, title: name };
}

/** 8-12, oppure 12 se min e max coincidono */
export const repsLabel = (min: number, max: number) => (min === max ? `${min}` : `${min}-${max}`);

/** Serie per muscolo principale, dal più allenato */
export function setsByMuscle(exercises: { sets: number; exercise: { primaryMuscle: string | null } | null }[]) {
  const totals = new Map<string, number>();
  for (const ex of exercises) {
    const muscle = ex.exercise?.primaryMuscle ?? "FULL_BODY";
    totals.set(muscle, (totals.get(muscle) ?? 0) + ex.sets);
  }
  return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
}
