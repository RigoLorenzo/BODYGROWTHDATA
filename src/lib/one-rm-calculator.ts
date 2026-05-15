export type OneRMFormula = "epley" | "brzycki" | "lombardi" | "mayhew" | "oconner";

export function calculateOneRM(weight: number, reps: number, formula: OneRMFormula = "epley"): number {
  if (reps === 1) return weight;
  if (reps <= 0 || weight <= 0) return 0;

  switch (formula) {
    case "epley":
      return weight * (1 + reps / 30);
    case "brzycki":
      return weight * (36 / (37 - reps));
    case "lombardi":
      return weight * Math.pow(reps, 0.10);
    case "mayhew":
      return (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps));
    case "oconner":
      return weight * (1 + 0.025 * reps);
    default:
      return weight * (1 + reps / 30);
  }
}

export function estimateRepsAtWeight(oneRM: number, targetWeight: number): number {
  if (targetWeight >= oneRM) return 1;
  const percentage = targetWeight / oneRM;
  // Inverse Epley
  return Math.round(30 * (1 / percentage - 1));
}

export function getPercentageOfOneRM(reps: number): number {
  const percentages: Record<number, number> = {
    1: 100, 2: 97, 3: 94, 4: 92, 5: 89,
    6: 86, 7: 83, 8: 81, 9: 78, 10: 75,
    12: 70, 15: 65, 20: 58,
  };
  return percentages[reps] ?? Math.max(40, 100 - (reps - 1) * 2.5);
}
