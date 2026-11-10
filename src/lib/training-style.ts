/**
 * Stili di allenamento: ognuno guarda indicatori diversi per dire se stai
 * migliorando. I testi sono pensati per chiunque, senza gergo: si mostrano
 * all'ingresso e nelle Impostazioni.
 */

export const TRAINING_STYLES = ["BODYBUILDING", "POWERLIFTING", "RUNNING", "HYBRID"] as const;
export type TrainingStyle = (typeof TRAINING_STYLES)[number];

export const isTrainingStyle = (value: unknown): value is TrainingStyle =>
  typeof value === "string" && (TRAINING_STYLES as readonly string[]).includes(value);

export interface StyleIndicator {
  name: string;
  /** cosa misura, in una frase */
  explain: string;
}

export interface StyleInfo {
  value: TrainingStyle;
  name: string;
  /** l'obiettivo, in tre parole */
  goal: string;
  /** per chi è */
  forWho: string;
  /** quando stai migliorando, detto semplice */
  progress: string;
  indicators: StyleIndicator[];
  /** la scheda di Fitness che si apre per prima */
  fitnessTab: "riepilogo" | "palestra" | "corsa";
}

export const STYLE_INFO: Record<TrainingStyle, StyleInfo> = {
  BODYBUILDING: {
    value: "BODYBUILDING",
    name: "Bodybuilding",
    goal: "Costruire muscoli",
    forWho: "Ti alleni in palestra per aumentare la massa e dare forma al corpo.",
    progress: "Migliori quando, settimana dopo settimana, fai più lavoro sui muscoli.",
    indicators: [
      { name: "Peso sollevato", explain: "Tutti i kg che sposti: peso × ripetizioni, sommati." },
      { name: "Serie per muscolo", explain: "Quante serie impegnative fai per ogni muscolo." },
      { name: "Esercizi in progresso", explain: "In quanti esercizi fai più peso o più ripetizioni del mese prima." },
      { name: "Costanza", explain: "Ogni muscolo allenato con regolarità, settimana dopo settimana." },
    ],
    fitnessTab: "palestra",
  },
  POWERLIFTING: {
    value: "POWERLIFTING",
    name: "Powerlifting",
    goal: "Diventare più forte",
    forWho: "Vuoi alzare il massimo possibile su squat, panca e stacco.",
    progress: "Migliori quando sale il massimo su squat, panca e stacco, e quando crescono gli esercizi che li sostengono.",
    indicators: [
      { name: "Massimale stimato", explain: "Su squat, panca e stacco: il peso che alzeresti una volta, calcolato dalle tue serie. Non serve provarlo." },
      { name: "Complementari", explain: "Gli esercizi di supporto (rematori, military, affondi…): in quanti fai più peso o più ripetizioni del mese prima." },
      { name: "Serie pesanti", explain: "Quante serie fai vicino al tuo massimo: sono quelle che allenano la forza." },
      { name: "Intensità", explain: "Quanto pesante ti alleni rispetto al massimo. Non è un voto: dice in che fase sei (tecnica, forza, picco)." },
    ],
    fitnessTab: "palestra",
  },
  RUNNING: {
    value: "RUNNING",
    name: "Corsa",
    goal: "Correre di più e meglio",
    forWho: "La corsa è il tuo allenamento principale: vuoi più resistenza o tempi migliori.",
    progress: "Migliori quando corri più strada, più veloce o con meno fatica.",
    indicators: [
      { name: "Km a settimana", explain: "Quanta strada fai: la base della resistenza." },
      { name: "Tempi su 5 e 10 km", explain: "I tuoi migliori tempi recenti: se scendono, sei più veloce." },
      { name: "Efficienza", explain: "Con lo stesso battito del cuore riesci ad andare più veloce." },
      { name: "Forma", explain: "Quanto allenamento ha accumulato il tuo corpo nelle ultime settimane." },
    ],
    fitnessTab: "corsa",
  },
  HYBRID: {
    value: "HYBRID",
    name: "Ibrido",
    goal: "Forza e resistenza insieme",
    forWho: "Alterni pesi, corsa e altre attività: vuoi essere in forma a 360°.",
    progress: "Migliori quando ti alleni con costanza e cresci sia in forza sia in resistenza.",
    indicators: [
      { name: "Carico totale", explain: "Quanto ti alleni in tutto: durata × fatica che senti, per ogni attività." },
      { name: "Equilibrio", explain: "Come si divide il tuo tempo tra pesi e attività di resistenza." },
      { name: "Forza e fiato", explain: "Un indicatore per la forza (massimale stimato) e uno per la resistenza (ritmo)." },
      { name: "Costanza", explain: "Quante settimane ti alleni con regolarità." },
    ],
    fitnessTab: "riepilogo",
  },
};
