/**
 * Tipi condivisi tra server e interfaccia del Coach (nessun import lato server).
 */

export interface CoachQuestion {
  id: string;
  question: string;
  options: string[];
  multiSelect: boolean;
  allowFreeText: boolean;
}

export interface ProposalExercise {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rpe: number | null;
  restSeconds: number;
  notes: string | null;
}

export interface ProposalDay {
  name: string;
  workoutType: string;
  exercises: ProposalExercise[];
}

export interface ProposalView {
  id: string;
  name: string;
  description: string | null;
  durationWeeks: number;
  frequency: number;
  rationale: string;
  status: "pending" | "applied" | "rejected";
  programId: string | null;
  days: ProposalDay[];
  warnings: string[];
}

/** Eventi inviati al browser durante una risposta (Server-Sent Events) */
export type CoachEvent =
  | { type: "thread"; threadId: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string; status: "start" | "end" }
  | { type: "ask_user"; questions: CoachQuestion[] }
  | { type: "proposal"; proposal: ProposalView }
  | { type: "memory"; fields: string[] }
  | { type: "done" }
  | { type: "error"; message: string };

/** Un messaggio come lo mostra la chat */
export type DisplayMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      tools: string[];
      questions: CoachQuestion[] | null;
      proposalIds: string[];
    };

export interface ThreadSummary {
  id: string;
  title: string | null;
  lastMessageAt: string;
}

/** Etichette leggibili dei tool, mostrate mentre il Coach lavora */
export const TOOL_LABELS: Record<string, string> = {
  get_athlete_overview: "Leggo il tuo profilo",
  get_program: "Guardo il tuo piano",
  query_training_data: "Conto i tuoi dati",
  get_exercise_history: "Guardo lo storico dell'esercizio",
  get_recovery_summary: "Controllo sonno e recupero",
  search_exercises: "Cerco gli esercizi",
  update_athlete_brief: "Annoto le tue preferenze",
  propose_program: "Preparo il piano",
  ask_user: "Ti faccio qualche domanda",
  web_search: "Cerco fonti affidabili",
  web_fetch: "Leggo una fonte",
};

export const toolLabel = (name: string) => TOOL_LABELS[name] ?? "Ci penso";
