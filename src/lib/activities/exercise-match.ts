/**
 * Esercizi registrati dall'orologio → esercizi della libreria dell'app.
 * Funzioni pure: ricevono la libreria (nomi e alias), non toccano il database.
 *
 * Garmin dà categoria e sottocategoria in maiuscolo (BENCH_PRESS,
 * BARBELL_BENCH_PRESS). Si prova prima la sottocategoria per nome o alias,
 * poi senza l'attrezzo iniziale, infine l'esercizio tipico della categoria.
 * Se nulla corrisponde si crea un esercizio personalizzato con quel nome.
 */

export interface LibraryEntry {
  name: string;
  aliases?: string[];
}

export type Muscle =
  | "CHEST"
  | "BACK"
  | "SHOULDERS"
  | "BICEPS"
  | "TRICEPS"
  | "FOREARMS"
  | "CORE"
  | "QUADS"
  | "HAMSTRINGS"
  | "GLUTES"
  | "CALVES"
  | "FULL_BODY";

/** Categoria Garmin → esercizio tipico della libreria e muscolo principale */
const CATEGORIES: Record<string, { exercise?: string; muscle: Muscle; label: string }> = {
  BENCH_PRESS: { exercise: "Barbell Bench Press", muscle: "CHEST", label: "Bench Press" },
  FLYE: { exercise: "Dumbbell Fly", muscle: "CHEST", label: "Fly" },
  PUSH_UP: { exercise: "Push-Up", muscle: "CHEST", label: "Push-Up" },
  ROW: { exercise: "Barbell Row", muscle: "BACK", label: "Row" },
  PULL_UP: { exercise: "Pull-Up", muscle: "BACK", label: "Pull-Up" },
  DEADLIFT: { exercise: "Deadlift", muscle: "BACK", label: "Deadlift" },
  HYPEREXTENSION: { exercise: "Back Extension", muscle: "BACK", label: "Back Extension" },
  SHRUG: { exercise: "Barbell Shrug", muscle: "BACK", label: "Shrug" },
  SHOULDER_PRESS: { exercise: "Overhead Press", muscle: "SHOULDERS", label: "Shoulder Press" },
  LATERAL_RAISE: { exercise: "Lateral Raise", muscle: "SHOULDERS", label: "Lateral Raise" },
  SHOULDER_STABILITY: { muscle: "SHOULDERS", label: "Shoulder Stability" },
  CURL: { exercise: "Dumbbell Curl", muscle: "BICEPS", label: "Curl" },
  TRICEPS_EXTENSION: { exercise: "Triceps Pushdown", muscle: "TRICEPS", label: "Triceps Extension" },
  SQUAT: { exercise: "Back Squat", muscle: "QUADS", label: "Squat" },
  LUNGE: { exercise: "Walking Lunge", muscle: "QUADS", label: "Lunge" },
  LEG_CURL: { exercise: "Lying Leg Curl", muscle: "HAMSTRINGS", label: "Leg Curl" },
  HIP_RAISE: { exercise: "Barbell Hip Thrust", muscle: "GLUTES", label: "Hip Raise" },
  HIP_STABILITY: { exercise: "Glute Bridge", muscle: "GLUTES", label: "Hip Stability" },
  HIP_SWING: { exercise: "Kettlebell Swing", muscle: "GLUTES", label: "Kettlebell Swing" },
  CALF_RAISE: { exercise: "Standing Calf Raise", muscle: "CALVES", label: "Calf Raise" },
  PLANK: { exercise: "Plank", muscle: "CORE", label: "Plank" },
  CORE: { exercise: "Plank", muscle: "CORE", label: "Core" },
  CRUNCH: { exercise: "Crunch", muscle: "CORE", label: "Crunch" },
  SIT_UP: { exercise: "Sit-Up", muscle: "CORE", label: "Sit-Up" },
  LEG_RAISE: { exercise: "Hanging Leg Raise", muscle: "CORE", label: "Leg Raise" },
  CHOP: { exercise: "Cable Woodchop", muscle: "CORE", label: "Chop" },
  CARRY: { exercise: "Farmer's Walk", muscle: "FULL_BODY", label: "Carry" },
  OLYMPIC_LIFT: { exercise: "Power Clean", muscle: "FULL_BODY", label: "Olympic Lift" },
  TOTAL_BODY: { exercise: "Burpee", muscle: "FULL_BODY", label: "Total Body" },
  PLYO: { exercise: "Box Jump", muscle: "QUADS", label: "Plyo" },
};

/** Attrezzi che Garmin mette davanti al nome e la libreria spesso no */
const EQUIPMENT_PREFIX = /^(barbell|dumbbell|cable|machine|kettlebell|smith machine|ez bar|band|weighted)\s+/;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]s\b/g, "s")
    .replace(/[_\-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** BARBELL_BENCH_PRESS → "Barbell Bench Press" */
export const humanizeCode = (code: string) =>
  code
    .toLowerCase()
    .split(/_+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export interface ExerciseMatch {
  /** nome esatto nella libreria, se trovato */
  libraryName: string | null;
  /** nome per l'esercizio personalizzato quando la libreria non basta */
  customName: string;
  muscle: Muscle;
  /** nome dato dall'orologio quando l'esercizio è quello tipico della categoria */
  sourceName: string | null;
}

/** Indice nome/alias normalizzato → nome della libreria */
export function libraryIndex(library: LibraryEntry[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of library) {
    index.set(normalize(entry.name), entry.name);
    for (const alias of entry.aliases ?? []) if (!index.has(normalize(alias))) index.set(normalize(alias), entry.name);
  }
  return index;
}

export function matchGarminExercise(index: Map<string, string>, category?: string | null, subCategory?: string | null): ExerciseMatch {
  const cat = (category ?? "").toUpperCase();
  const known = CATEGORIES[cat];
  const muscle = known?.muscle ?? "FULL_BODY";
  const sub = subCategory && subCategory.toUpperCase() !== "UNKNOWN" ? subCategory : null;

  if (sub) {
    const full = normalize(sub);
    const hit = index.get(full) ?? index.get(full.replace(EQUIPMENT_PREFIX, ""));
    if (hit) return { libraryName: hit, customName: hit, muscle, sourceName: null };
  }
  // Variante non in libreria: l'esercizio tipico della categoria (conta per
  // muscoli e progressi), con il nome dell'orologio nelle note
  if (known?.exercise && index.has(normalize(known.exercise))) {
    const exercise = index.get(normalize(known.exercise))!;
    return { libraryName: exercise, customName: exercise, muscle, sourceName: sub ? humanizeCode(sub) : null };
  }
  const name = sub ? humanizeCode(sub) : known ? known.label : cat && cat !== "UNKNOWN" ? humanizeCode(cat) : "Esercizio non classificato";
  return { libraryName: null, customName: name, muscle, sourceName: null };
}

/**
 * Serie di un esercizio dai totali Garmin (serie, ripetizioni, volume e
 * carico massimo): le ripetizioni si dividono tra le serie e il carico è la
 * media (volume / ripetizioni), così volume e totali restano esatti.
 */
export function setsFromSummary(summary: { sets?: number | null; reps?: number | null; volumeKg?: number | null }) {
  const count = Math.max(1, Math.round(summary.sets ?? 1));
  const reps = Math.max(0, Math.round(summary.reps ?? 0));
  const base = Math.floor(reps / count);
  const extra = reps - base * count;
  const avg = reps > 0 && summary.volumeKg && summary.volumeKg > 0 ? summary.volumeKg / reps : null;
  // Mezzo chilo: la precisione dei dischi in palestra
  const weight = avg != null ? Math.round(avg * 2) / 2 : null;
  return Array.from({ length: count }, (_, i) => ({ reps: reps ? base + (i < extra ? 1 : 0) : null, weight }));
}
