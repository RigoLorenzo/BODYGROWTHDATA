/**
 * Interpretazione del BMI.
 *
 * Il BMI resta quello standard (kg / m²) e la sua categoria non viene mai
 * alterata: qui si aggiunge solo una lettura, usando i dati che l'utente ha
 * già inserito (profilo + Misurazioni Corporee). Nessun dato è obbligatorio:
 * con soli altezza e peso si ottiene il BMI standard e nient'altro.
 */

export interface BodyCompositionInput {
  heightCm?: number | null;
  weightKg?: number | null;
  /** Ultima misurazione disponibile */
  bodyFatPercent?: number | null;
  muscleMassKg?: number | null;
  waistCm?: number | null;
  /** Misurazione precedente, per leggere la direzione del trend */
  previous?: {
    date?: string | Date | null;
    weightKg?: number | null;
    bodyFatPercent?: number | null;
    muscleMassKg?: number | null;
  } | null;
}

export type BmiReadingKey =
  | "STANDARD"
  | "ABOVE_RANGE"
  | "ABOVE_RANGE_LEAN_MASS"
  | "ABOVE_RANGE_UNKNOWN";

export interface BodyCompositionAnalysis {
  bmi: number | null;
  bmiCategory: { label: string; color: string } | null;
  leanMassKg: number | null;
  ffmi: number | null;
  /** FFMI normalizzato all'altezza di 1,80 m */
  ffmiNormalized: number | null;
  waistToHeight: number | null;
  reading: {
    key: BmiReadingKey;
    title: string;
    body: string;
    tone: "neutral" | "info" | "warning";
  } | null;
  /** Dati che hanno contribuito alla lettura, per mostrarli all'utente */
  usedSignals: string[];
  /** Cosa manca per una lettura più precisa (mai obbligatorio) */
  missingSignals: string[];
  trendNote: string | null;
}

/** Categoria BMI standard OMS — invariata */
export function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Sottopeso", color: "text-blue-400" };
  if (bmi < 25) return { label: "Normopeso", color: "text-green-400" };
  if (bmi < 30) return { label: "Sovrappeso", color: "text-yellow-400" };
  return { label: "Obesità", color: "text-red-400" };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  return weightKg / Math.pow(heightCm / 100, 2);
}

/** Massa magra dalla percentuale di grasso corporeo */
export function calculateLeanMass(weightKg: number, bodyFatPercent: number): number {
  return weightKg * (1 - bodyFatPercent / 100);
}

/** FFMI = massa magra / altezza², con normalizzazione a 1,80 m */
export function calculateFFMI(leanMassKg: number, heightCm: number) {
  const heightM = heightCm / 100;
  const ffmi = leanMassKg / Math.pow(heightM, 2);
  return { ffmi, normalized: ffmi + 6.1 * (1.8 - heightM) };
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

export function analyzeBodyComposition(input: BodyCompositionInput): BodyCompositionAnalysis {
  const height = num(input.heightCm);
  const weight = num(input.weightKg);
  const bodyFat = num(input.bodyFatPercent);
  const muscleMass = num(input.muscleMassKg);
  const waist = num(input.waistCm);

  const empty: BodyCompositionAnalysis = {
    bmi: null,
    bmiCategory: null,
    leanMassKg: null,
    ffmi: null,
    ffmiNormalized: null,
    waistToHeight: null,
    reading: null,
    usedSignals: [],
    missingSignals: [],
    trendNote: null,
  };

  if (!height || !weight) return empty;

  const bmi = calculateBMI(weight, height);
  const bmiCategory = getBMICategory(bmi);

  const leanMassKg = bodyFat ? calculateLeanMass(weight, bodyFat) : null;
  const ffmiValues = leanMassKg ? calculateFFMI(leanMassKg, height) : null;
  const waistToHeight = waist ? waist / height : null;

  const usedSignals: string[] = [];
  const missingSignals: string[] = [];

  // Ogni indizio vale "forte" o "debole": due deboli equivalgono a uno forte.
  let leanEvidence = 0;
  let fatEvidence = 0;

  if (bodyFat) {
    usedSignals.push(`massa grassa ${bodyFat.toFixed(1)}%`);
    if (bodyFat < 15) leanEvidence += 2;
    else if (bodyFat < 20) leanEvidence += 1;
    else if (bodyFat >= 25) fatEvidence += 2;
  } else {
    missingSignals.push("percentuale di massa grassa");
  }

  if (ffmiValues) {
    usedSignals.push(`FFMI ${ffmiValues.normalized.toFixed(1)}`);
    if (ffmiValues.normalized >= 20) leanEvidence += 2;
    else if (ffmiValues.normalized >= 18) leanEvidence += 1;
  }

  if (waistToHeight) {
    usedSignals.push(`vita/altezza ${waistToHeight.toFixed(2)}`);
    if (waistToHeight < 0.5) leanEvidence += 2;
    else if (waistToHeight >= 0.55) fatEvidence += 2;
    else fatEvidence += 1;
  } else {
    missingSignals.push("circonferenza vita");
  }

  // La massa muscolare da bilancia non basta da sola per stimare la massa magra:
  // vale solo come indizio debole a supporto.
  if (muscleMass && !bodyFat) {
    usedSignals.push(`massa muscolare ${muscleMass.toFixed(1)} kg`);
    if (muscleMass / weight >= 0.45) leanEvidence += 1;
  }

  let reading: BodyCompositionAnalysis["reading"] = null;

  if (bmi < 25) {
    reading = {
      key: "STANDARD",
      title: `BMI nel range standard (${bmiCategory.label.toLowerCase()})`,
      body: "Il valore rientra nei riferimenti standard: non serve nessuna interpretazione aggiuntiva.",
      tone: "neutral",
    };
  } else if (leanEvidence >= 2 && leanEvidence > fatEvidence) {
    reading = {
      key: "ABOVE_RANGE_LEAN_MASS",
      title: "BMI potenzialmente influenzato da elevata massa magra",
      body: `Il BMI è sopra il range standard, ma i tuoi dati (${usedSignals.join(", ")}) indicano una componente magra rilevante: in questo caso il solo BMI tende a sovrastimare il grasso corporeo.`,
      tone: "info",
    };
  } else if (usedSignals.length > 0) {
    reading = {
      key: "ABOVE_RANGE",
      title: "BMI sopra il range standard",
      body: `I dati disponibili (${usedSignals.join(", ")}) non indicano che il valore sia dovuto alla massa magra.`,
      tone: "warning",
    };
  } else {
    reading = {
      key: "ABOVE_RANGE_UNKNOWN",
      title: "BMI sopra il range standard",
      body: "Con solo altezza e peso non è possibile dire se dipenda da massa grassa o massa magra. Aggiungendo massa grassa o circonferenza vita nelle Misurazioni Corporee la lettura diventa più precisa.",
      tone: "neutral",
    };
  }

  // Direzione del trend: solo se lo storico ha davvero due punti confrontabili
  let trendNote: string | null = null;
  const prev = input.previous;
  if (prev) {
    const prevWeight = num(prev.weightKg);
    const prevFat = num(prev.bodyFatPercent);
    const prevMuscle = num(prev.muscleMassKg);
    if (bodyFat && prevFat && weight && prevWeight) {
      const fatDelta = bodyFat - prevFat;
      const weightDelta = weight - prevWeight;
      if (Math.abs(fatDelta) >= 0.3 || Math.abs(weightDelta) >= 0.3) {
        if (weightDelta > 0 && fatDelta <= 0) {
          trendNote = `Rispetto alla misurazione precedente il peso è salito di ${weightDelta.toFixed(1)} kg con massa grassa in calo (${fatDelta.toFixed(1)}%): l'aumento è compatibile con massa magra.`;
        } else if (weightDelta < 0 && fatDelta < 0) {
          trendNote = `Rispetto alla misurazione precedente hai perso ${Math.abs(weightDelta).toFixed(1)} kg con massa grassa in calo (${fatDelta.toFixed(1)}%).`;
        } else if (fatDelta > 0) {
          trendNote = `Rispetto alla misurazione precedente la massa grassa è salita di ${fatDelta.toFixed(1)}%.`;
        }
      }
    } else if (muscleMass && prevMuscle && Math.abs(muscleMass - prevMuscle) >= 0.3) {
      const delta = muscleMass - prevMuscle;
      trendNote = `Massa muscolare ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg rispetto alla misurazione precedente.`;
    }
  }

  return {
    bmi,
    bmiCategory,
    leanMassKg,
    ffmi: ffmiValues?.ffmi ?? null,
    ffmiNormalized: ffmiValues?.normalized ?? null,
    waistToHeight,
    reading,
    usedSignals,
    missingSignals,
    trendNote,
  };
}
