import type { PlanDefinition } from "./types";

/**
 * Multifrequenza 4x — scheda creata con Claude (versione di allineamento:
 * face pull in G2 e reverse pec deck in G3 per il deltoide posteriore).
 * Serie per seduta: G1 28, G2 30, G3 29, G4 27 — 114 a settimana.
 */
export const multifrequenza4x: PlanDefinition = {
  name: "Multifrequenza 4x — Forza + Ipertrofia",
  description:
    "4 sedute/settimana. Focus forza: panca piana, military press, rematore dead stop. Priorità: braccia (15 serie bicipiti, 15 tricipiti) e trapezi (2 esercizi). Corsa nei giorni liberi.",
  frequency: 4,
  durationWeeks: 12,
  splitType: "CUSTOM",
  days: [
    {
      name: "G1 — Panca (forza) · Dorso · Braccia",
      workoutType: "UPPER",
      exercises: [
        { name: "Barbell Bench Press", sets: 4, repsMin: 4, repsMax: 6, rpe: 9, restSeconds: 180, notes: "Forza — RIR 1" },
        { name: "Lat Pulldown", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 120 },
        { name: "Machine Chest Press", sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, notes: "Chest press Teca" },
        { name: "Seated Cable Row", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90, notes: "Pulley sbarra larga" },
        { name: "Low Cable Fly", sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60, notes: "Complementare petto" },
        { name: "Machine Lateral Raise", sets: 4, repsMin: 15, repsMax: 20, restSeconds: 60 },
        { name: "Rope Pushdown", sets: 4, repsMin: 10, repsMax: 12, restSeconds: 75 },
        { name: "Incline Dumbbell Curl", sets: 4, repsMin: 8, repsMax: 12, restSeconds: 75 },
      ],
    },
    {
      name: "G2 — Gambe A · Deltoidi · Braccia",
      workoutType: "LOWER",
      exercises: [
        { name: "Front Squat", sets: 4, repsMin: 5, repsMax: 8, rpe: 8.5, restSeconds: 150 },
        { name: "Bulgarian Split Squat", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 90, notes: "Reps per gamba" },
        { name: "45-Degree Back Extension", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90, notes: "Zavorrata" },
        { name: "Cable Lateral Raise", sets: 4, repsMin: 12, repsMax: 15, restSeconds: 60 },
        { name: "Face Pull", sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60, notes: "Deltoide posteriore — rotazione esterna in chiusura" },
        { name: "Standing Calf Raise", sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60, notes: "Alla macchina" },
        { name: "Tibialis Raise", sets: 2, repsMin: 15, repsMax: 15, restSeconds: 45, notes: "Seduto con kettlebell" },
        { name: "EZ-Bar Curl", sets: 4, repsMin: 8, repsMax: 10, restSeconds: 60, notes: "Superset con tricipiti Batman" },
        { name: "Triceps Pushdown", sets: 4, repsMin: 8, repsMax: 10, restSeconds: 90, notes: "Sbarra Batman — superset con curl EZ" },
      ],
    },
    {
      name: "G3 — Military (forza) · Petto · Dorso · Trapezi · Braccia",
      workoutType: "PUSH",
      exercises: [
        { name: "Overhead Press", sets: 4, repsMin: 4, repsMax: 6, rpe: 9, restSeconds: 180, notes: "Military press — forza, RIR 1" },
        { name: "Incline Dumbbell Press", sets: 3, repsMin: 8, repsMax: 10, restSeconds: 120 },
        { name: "Lateral Raise", sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60 },
        { name: "Reverse Pec Deck", sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60, notes: "Deltoide posteriore" },
        { name: "Pec Deck", sets: 3, repsMin: 12, repsMax: 12, restSeconds: 75, notes: "Croci verticali / ai cavi" },
        { name: "Straight-Arm Pulldown", sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60, notes: "Complementare dorso" },
        { name: "Dumbbell Shrug", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 75, notes: "Pausa 1s in alto — trapezio superiore" },
        { name: "Overhead Cable Triceps Extension", sets: 4, repsMin: 10, repsMax: 12, restSeconds: 75 },
        { name: "Preacher Curl", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60 },
      ],
    },
    {
      name: "G4 — Rematore (forza) · Gambe B · Trapezi · Braccia",
      workoutType: "PULL",
      exercises: [
        { name: "Pendlay Row", sets: 5, repsMin: 5, repsMax: 6, rpe: 9, restSeconds: 165, notes: "Rematore dead stop a terra — forza, RIR 1" },
        { name: "Chin-Up", sets: 3, repsMin: 6, repsMax: 12, restSeconds: 120, notes: "Max reps, RIR 1" },
        { name: "Romanian Deadlift", sets: 3, repsMin: 6, repsMax: 8, restSeconds: 150 },
        { name: "Hip Adduction Machine", sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60, notes: "In alternativa leg extension" },
        { name: "Rear Delt Fly", sets: 3, repsMin: 15, repsMax: 20, restSeconds: 60 },
        { name: "Kelso Shrug", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 75, notes: "Petto appoggiato, retrazione scapole — trapezio medio" },
        { name: "EZ-Bar Skullcrusher", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 75 },
        { name: "Hammer Curl", sets: 4, repsMin: 8, repsMax: 12, restSeconds: 75 },
      ],
    },
  ],
};
