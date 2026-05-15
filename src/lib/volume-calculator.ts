export interface SetData {
  weight?: number | null;
  reps?: number | null;
  type: string;
  rpe?: number | null;
}

export function calculateSetVolume(set: SetData): number {
  if (!set.weight || !set.reps) return 0;
  return set.weight * set.reps;
}

export function calculateExerciseVolume(sets: SetData[]): number {
  return sets
    .filter((s) => s.type !== "WARMUP")
    .reduce((sum, s) => sum + calculateSetVolume(s), 0);
}

export function calculateSessionVolume(exercises: { sets: SetData[] }[]): number {
  return exercises.reduce((sum, ex) => sum + calculateExerciseVolume(ex.sets), 0);
}

export function calculateWeightedVolume(sets: SetData[]): number {
  return sets
    .filter((s) => s.type !== "WARMUP")
    .reduce((sum, s) => {
      const vol = calculateSetVolume(s);
      const rpeMultiplier = s.rpe ? 1 + (s.rpe - 5) * 0.05 : 1;
      return sum + vol * rpeMultiplier;
    }, 0);
}

export function getProgressiveOverloadSuggestion(
  currentWeight: number,
  currentReps: number,
  targetReps: number
): { weight: number; reps: number; strategy: string } {
  if (currentReps >= targetReps) {
    const increment = currentWeight >= 100 ? 2.5 : currentWeight >= 60 ? 1.25 : 1;
    return {
      weight: currentWeight + increment,
      reps: Math.max(targetReps - 2, 1),
      strategy: `Aumenta peso di ${increment}kg`,
    };
  }
  return {
    weight: currentWeight,
    reps: Math.min(currentReps + 1, targetReps),
    strategy: "Aggiungi una ripetizione",
  };
}

export function calculatePlateConfiguration(
  targetWeight: number,
  barbellWeight: number = 20,
  availablePlates: number[] = [20, 15, 10, 5, 2.5, 1.25]
): { plates: number[]; totalWeight: number } {
  const perSide = (targetWeight - barbellWeight) / 2;
  if (perSide < 0) return { plates: [], totalWeight: barbellWeight };

  const plates: number[] = [];
  let remaining = perSide;

  for (const plate of availablePlates.sort((a, b) => b - a)) {
    while (remaining >= plate - 0.001) {
      plates.push(plate);
      remaining -= plate;
    }
  }

  const totalWeight = barbellWeight + plates.reduce((s, p) => s + p * 2, 0);
  return { plates, totalWeight };
}
