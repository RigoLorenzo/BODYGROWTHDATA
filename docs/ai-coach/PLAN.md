# Coach AI — Piano di progetto

> Un personal trainer conversazionale dentro BodyGrowth: legge i tuoi dati, fa le domande giuste,
> crea e modifica il piano su tua autorizzazione, ti segue nel tempo e ti scrive ogni settimana.
>
> **Funzione a pagamento: BodyGrowth Coach, 15 €/mese + IVA.** Pagamento con Apple Pay, Google Pay o carta.
> Accesso gratuito solo per gli utenti scelti dal proprietario (oggi: solo il proprietario). Dettagli al §11.

---

## 1. Obiettivo e problema

**Problema:** inserire a mano il primo piano è la parte più faticosa dell'app (builder con giorni, esercizi,
serie, range di ripetizioni, recuperi). Chi inizia abbandona prima di arrivare ai grafici, che sono il vero valore.

**Soluzione:** una sezione **Coach** in cui l'utente scrive in linguaggio naturale
("voglio fare ipertrofia, 4 giorni, ho mal di spalla, odio lo stacco") e un agente:

1. legge profilo, stile, storico, record, volume per muscolo, corsa e recupero;
2. capisce cosa manca e **chiede prima di agire** (giorni, durata, attrezzatura, esercizi preferiti/odiati, infortuni);
3. **propone** un piano o una modifica con anteprima e motivazioni;
4. lo **applica solo con il tuo ok** (o in autonomia entro i limiti scelti nelle impostazioni), con versioni e annulla;
5. ti segue: review settimanale, commento dopo l'allenamento, avvisi su stallo/sovraccarico, via chat e notifica push;
6. **risponde con i tuoi numeri veri** a qualsiasi domanda sui dati ("quante serie di petto ho fatto quest'anno?",
   "quanti km ho corso a ottobre?", "com'è andata da quando uso l'app?"), tenendo conto dei **cambi di piano** (§7).

**Metriche di successo**

| Metrica | Target |
|---|---|
| Tempo dalla registrazione al primo piano attivo | < 5 minuti |
| % proposte del coach applicate | > 60% |
| Utenti con piano attivo a 30 giorni | +50% rispetto a oggi |
| Aderenza (sedute fatte / pianificate) di chi usa il coach | > chi non lo usa |
| Conversione visita pagina Coach → abbonamento | > 3% |
| Abbonati che restano dopo il 1° mese | > 70% |

---

## 2. Principi architetturali (decisioni chiave)

1. **Il modello ragiona, il codice calcola.** Ogni numero (volume, e1RM, aderenza, km, sonno) arriva da funzioni
   deterministiche già presenti (`muscle-volume.ts`, `insights.ts`, `insight-engine.ts`, `progression.ts`,
   `one-rm-calculator.ts`, `run/load.ts`, `wellness/*`). L'LLM non fa aritmetica sui dati grezzi → niente numeri inventati.
2. **Il coach non scrive mai direttamente nel DB del piano.** I tool di scrittura creano una `PlanProposal`
   validata; l'applicazione passa da un endpoint deterministico che riusa `program-writer.ts`
   (`createProgram` / `updateProgram` / `assertExercisesUsable`). Questo è anche la difesa principale da prompt injection.
3. **Domande gestite in modo strutturato, non affidate al caso.** Un elenco di "slot" obbligatori (giorni,
   durata seduta, attrezzatura, obiettivo, livello, infortuni) è calcolato dal server; `propose_program`
   rifiuta la proposta se mancano slot → il modello è *costretto* a chiedere. Le domande arrivano alla UI
   come chip cliccabili (tool `ask_user`).
4. **Memoria esplicita e modificabile.** Preferenze e vincoli dell'atleta vivono in una tabella (`AthleteBrief`),
   visibile e modificabile dall'utente, non sepolti nello storico chat.
5. **Tutto reversibile.** Ogni modifica del piano crea una `ProgramRevision`: annulla con un tap.
6. **L'accesso si decide solo sul server.** Una sola funzione, `hasCoachAccess(userId)`, protegge ogni endpoint
   del coach, il cron e la pagina. L'abbonamento si attiva solo dal webhook firmato del provider di pagamento,
   mai dal redirect del browser. La logica non dipende da un provider specifico, così domani si aggiungono
   App Store e Google Play senza riscriverla.
7. **La storia è divisa in blocchi.** Ogni periodo con un piano diverso è un *blocco di allenamento* registrato
   (`TrainingPhase`). Quando il periodo richiesto attraversa più blocchi, la risposta lo dice in modo esplicito
   e confronta solo ciò che è confrontabile (§7.2).
8. **Rispetto delle decisioni prese.** Nel flusso di allenamento non ci sono consigli di carico (commit
   `f169abe`): il coach parla di progressione in chat e nelle review, non dentro la schermata della seduta.

---

## 3. Stack tecnico

| Componente | Scelta | Motivo |
|---|---|---|
| LLM | Claude API, SDK ufficiale `@anthropic-ai/sdk` | Tool use nativo, streaming, caching, web search server-side |
| Modello | `claude-opus-5-5` | Miglior qualità di ragionamento per programmazione dell'allenamento; costo contenuto con caching |
| Thinking / effort | adaptive (sempre attivo su Opus 5.5); `effort: "medium"` in chat, `"high"` per creare/ristrutturare un piano | Effort è l'unica leva su Opus 5.5 (default `medium`, va impostato esplicitamente) |
| Rifiuti | `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) | Se un classificatore blocca per falso positivo, la richiesta riparte su un modello di fallback |
| Loop agente | Loop manuale lato server (max 8 iterazioni) | Serve emettere eventi SSE per ogni tool e intercettare `ask_user`/proposte |
| Streaming | Route Handler Next.js → SSE (`text/event-stream`) | Vercel `maxDuration` 300 s, già usato nel progetto |
| Conoscenza web | Tool server `web_search_20260209` con `allowed_domains` e `max_uses: 3` | Evidenze aggiornate da fonti affidabili, senza codice nostro |
| Validazione | Zod (già in uso: `program-schema.ts`) | Ogni input dei tool validato prima di eseguire |
| Push | Web Push standard (VAPID) con pacchetto `web-push` + handler in `public/sw.js` | La PWA c'è già; nessun servizio esterno |
| Job pianificati | Vercel Cron (già usato in `vercel.json`) | Review settimanale e controlli giornalieri |
| Persistenza | PostgreSQL / Prisma (nuove tabelle, §5) | Coerente con il resto |
| Pagamenti | Stripe Billing + Stripe Checkout (abbonamento mensile) | Apple Pay e Google Pay inclusi senza codice in più, 3D Secure/SCA gestiti, nessun dato di carta sui nostri server |
| Gestione abbonamento | Stripe Customer Portal | Disdetta, cambio carta e ricevute già pronti |
| IVA | Stripe Tax (IVA italiana e OSS per gli altri Paesi UE) | Prezzo mostrato IVA inclusa, come richiesto per i consumatori UE |

**Dettagli Opus 5.5 da rispettare nel codice**

- `tool_choice` forzato (`any`/`tool`) restituisce 400 → solo `auto`, con `strict: true` sugli schemi dei tool.
- Niente prefill dell'assistente; formato controllato via prompt/schema.
- I blocchi `thinking` vanno salvati e reinviati **invariati**: lo storico della chat è append-only
  (si salva `response.content` completo in `CoachMessage.content`, mai solo il testo).
- Prompt caching: `tools` + `system` stabili con `cache_control`; i dati volatili (snapshot atleta, data di oggi)
  dopo l'ultimo breakpoint, come messaggio `system` a metà conversazione (non modificando il system iniziale).
- Thread lunghi: compaction server-side (beta `compact-2026-01-12`); in alternativa nuovo thread per argomento.

---

## 4. Architettura

```
┌──────────────── Client (PWA) ────────────────┐
│ /coach  chat · chip domande · card proposta  │
│ /coach/settings  impostazioni · memoria      │
└───────────────┬──────────────────────────────┘
                │ POST /api/coach/chat  (SSE)
┌───────────────▼──────────────────────────────┐
│ Agent loop (src/lib/coach/loop.ts)           │
│  system prompt + knowledge pack (cached)     │
│  snapshot atleta (system mid-conversation)   │
│  ┌──────────── tool ─────────────┐           │
│  │ lettura  → funzioni esistenti │──► Prisma │
│  │ memoria  → AthleteBrief       │           │
│  │ ask_user → chiude il turno    │           │
│  │ proposte → PlanProposal       │           │
│  │ web_search (server Anthropic) │           │
│  └───────────────────────────────┘           │
└───────────────┬──────────────────────────────┘
                │ utente tocca "Applica"
┌───────────────▼──────────────────────────────┐
│ POST /api/coach/proposals/:id/apply          │
│  ri-valida → ProgramRevision → program-writer│
└──────────────────────────────────────────────┘

Cron giornaliero ─► /api/cron/coach  ─► review settimanali (utenti del giorno)
                                     ─► nudge (stallo, sedute saltate, recupero)
                                     ─► CoachMessage + Notification + Web Push
```

### Eventi SSE verso il client

| Evento | Payload | UI |
|---|---|---|
| `text_delta` | testo | bolla che si scrive |
| `tool_start` / `tool_end` | nome, etichetta umana | "Sto guardando le ultime 6 settimane…" |
| `ask_user` | domande + opzioni | chip cliccabili / multi-selezione / testo libero |
| `proposal` | id, titolo, riepilogo, diff | card con anteprima, **Applica** / **Modifica** / **Scarta** |
| `memory_updated` | campi cambiati | toast discreto "Ho annotato: niente stacco" |
| `done` / `error` | usage, motivo | stato finale |

---

## 5. Modello dati (Prisma)

```prisma
enum CoachAutonomy { ASK_ALWAYS  AUTO_MINOR  AUTO_ALL_EXCEPT_NEW_PLAN }
enum CoachTone     { MOTIVATIONAL  BALANCED  TECHNICAL }
enum CoachThreadKind { CHAT  ONBOARDING  WEEKLY_REVIEW  NUDGE }
enum ProposalStatus  { PENDING  APPLIED  REJECTED  EXPIRED  SUPERSEDED }
enum RevisionSource  { USER  COACH }

model CoachSettings {
  id                String        @id @default(cuid())
  userId            String        @unique
  enabled           Boolean       @default(true)
  tone              CoachTone     @default(BALANCED)
  autonomy          CoachAutonomy @default(ASK_ALWAYS)
  weeklyReviewDay   Int           @default(1)      // 1 = lunedì
  weeklyReviewHour  Int           @default(8)
  timezone          String        @default("Europe/Rome")
  notifyWeekly      Boolean       @default(true)
  notifyPostWorkout Boolean       @default(true)
  notifyAlerts      Boolean       @default(true)   // stallo, sovraccarico, sedute saltate
  quietFrom         Int?                           // ore silenziose
  quietTo           Int?
  healthDataConsent DateTime?                      // consenso esplicito dati benessere (GDPR art. 9)
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)
}

/// Memoria strutturata del coach: l'utente la vede e la modifica
model AthleteBrief {
  id                  String   @id @default(cuid())
  userId              String   @unique
  primaryGoal         String?                // ipertrofia, forza, 10 km sotto 50', ricomposizione…
  goalDetails         String?  @db.Text
  daysPerWeek         Int?
  preferredDays       Int[]                  // 1..7
  sessionMinutes      Int?
  equipment           String[]               // valori enum Equipment / "palestra completa"
  likedExerciseIds    String[]
  dislikedExerciseIds String[]
  injuries            Json?                  // [{ area, note, since, avoidMovements[] }]
  notes               String?  @db.Text      // note libere annotate dal coach
  updatedAt           DateTime @updatedAt
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model CoachThread {
  id            String          @id @default(cuid())
  userId        String
  kind          CoachThreadKind @default(CHAT)
  title         String?
  lastMessageAt DateTime        @default(now())
  createdAt     DateTime        @default(now())
  messages      CoachMessage[]
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, lastMessageAt])
}

model CoachMessage {
  id        String      @id @default(cuid())
  threadId  String
  role      String                         // user | assistant | system
  content   Json                           // blocchi completi (thinking, tool_use, tool_result…)
  usage     Json?                          // token in/out/cache per costi e limiti
  createdAt DateTime    @default(now())
  thread    CoachThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  @@index([threadId, createdAt])
}

model PlanProposal {
  id         String         @id @default(cuid())
  userId     String
  threadId   String
  programId  String?                       // null = nuovo piano
  payload    Json                          // ProgramInput completo dopo le modifiche
  summary    String         @db.Text       // motivazioni in parole semplici
  diff       Json                          // operazioni leggibili per la card
  warnings   Json?                         // esiti della validazione
  status     ProposalStatus @default(PENDING)
  appliedAt  DateTime?
  createdAt  DateTime       @default(now())
  @@index([userId, status])
}

model ProgramRevision {
  id         String         @id @default(cuid())
  programId  String
  snapshot   Json                          // ProgramInput prima della modifica
  source     RevisionSource
  proposalId String?
  createdAt  DateTime       @default(now())
  @@index([programId, createdAt])
}

model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

### Blocchi di allenamento (per tutti gli utenti, anche senza Coach)

```prisma
enum PhaseReason { PLAN_STARTED  PLAN_SWITCHED  PLAN_CHANGED  PLAN_STOPPED  BACKFILL }

/// Un periodo con lo stesso piano. Si chiude quando il piano cambia, si modifica in modo
/// sostanziale o si disattiva. Gli allenamenti fuori da un piano hanno phaseId = null ("allenamento libero").
model TrainingPhase {
  id          String         @id @default(cuid())
  userId      String
  programId   String?                        // null se il piano è stato poi eliminato
  programName String                         // copiato all'apertura: resta leggibile anche dopo
  structure   Json                           // struttura del piano in quel periodo (giorni, esercizi, serie)
  splitType   SplitType
  frequency   Int
  startedAt   DateTime
  endedAt     DateTime?                      // null = blocco in corso
  reason      PhaseReason
  source      RevisionSource @default(USER)  // cambiato da te o dal Coach
  createdAt   DateTime       @default(now())
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions    WorkoutSession[]
  @@index([userId, startedAt])
}

// WorkoutSession: nuovo campo phaseId String? (relazione con TrainingPhase, onDelete: SetNull)
```

### Abbonamento

```prisma
enum BillingProvider    { STRIPE  APP_STORE  PLAY_STORE }
enum SubscriptionStatus { ACTIVE  TRIALING  PAST_DUE  CANCELED  INCOMPLETE  EXPIRED }

/// Fonte di verità dell'accesso a pagamento al Coach (aggiornata solo dai webhook)
model CoachSubscription {
  id                 String             @id @default(cuid())
  userId             String             @unique
  provider           BillingProvider    @default(STRIPE)
  customerId         String                              // Stripe customer (cus_…)
  subscriptionId     String             @unique          // Stripe subscription (sub_…)
  priceId            String
  status             SubscriptionStatus
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean            @default(false)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  user               User               @relation(fields: [userId], references: [id], onDelete: Cascade)
}

/// Webhook già elaborati: lo stesso evento non si applica due volte
model BillingEvent {
  id          String   @id                               // id evento Stripe (evt_…)
  type        String
  processedAt DateTime @default(now())
}

/// Lista d'attesa prima dell'apertura delle vendite
model CoachWaitlist {
  userId    String   @id
  createdAt DateTime @default(now())
}
```

Il campo `User.subscriptionTier` esistente (oggi inutilizzato) resta compatibile: il webhook lo porta a `PRO`
quando l'abbonamento è attivo e a `FREE` quando scade. La fonte di verità resta però `CoachSubscription`.

Più: `NotificationType` += `COACH_REVIEW`, `COACH_NUDGE`, `COACH_PROPOSAL`.
Il `Goal` esistente resta per i target numerici (peso, alzata); il coach lo legge e può proporne di nuovi.

---

## 6. Tool dell'agente

Tutti i tool ricevono `userId` **dalla sessione server**, mai dal modello. Input validati con Zod, `strict: true`.

### Lettura (riusano la logica esistente)

| Tool | Restituisce | Sorgente |
|---|---|---|
| `get_athlete_overview` | profilo, stile, livello, obiettivi, brief, piano attivo (settimana/giorno), aderenza 4 settimane | `Profile`, `TrainingStyle`, `Goal`, `ActiveProgram`, `program-progress.ts`, `insights.consistency` |
| `get_program` | piano completo con id esercizi | `Program` + giorni + esercizi |
| `get_training_history` | sedute aggregate per settimana, filtri muscolo/esercizio | `WorkoutSession`, `insights.weeklySeries` |
| `get_exercise_progress` | ultime serie, trend e1RM, record, stallo sì/no | `progression.ts`, `one-rm-calculator.ts`, `pr-detector.ts`, `insight-engine.ts` |
| `get_muscle_volume` | serie allenanti/settimana per muscolo vs range consigliati per livello | `muscle-volume.ts` |
| `get_running_summary` | km/settimana, uscita lunga, passo, CTL/ATL/TSB | `run/stats.ts`, `run/load.ts` |
| `get_recovery_summary` | sonno, FC a riposo, stress, trend 14 giorni (solo con consenso) | `WellnessDay`, `SleepSession`, `wellness/insights.ts` |
| `search_exercises` | esercizi della libreria + custom (id, nome IT, muscoli, attrezzatura, difficoltà) | `Exercise`, `exercise-library.ts` |
| `query_training_data` | **qualsiasi numero sui tuoi allenamenti**, con periodo, filtri e raggruppamento (§7.1) | `src/lib/coach/data/query.ts` |
| `get_training_phases` | elenco dei blocchi (piano, date, sedute, aderenza) | `TrainingPhase` |
| `get_training_story` | riepilogo dall'inizio, blocco per blocco (§7.3) | `src/lib/coach/data/story.ts` |

### Memoria e interazione

| Tool | Comportamento |
|---|---|
| `update_athlete_brief(patch)` | Aggiorna preferenze/vincoli emersi in chat; evento `memory_updated` |
| `ask_user(questions[])` | Domande con opzioni (singola/multipla/testo libero); **chiude il turno**; la risposta arriva come messaggio utente |

### Proposte (mai scrittura diretta)

| Tool | Comportamento |
|---|---|
| `propose_program(program, rationale)` | Crea un nuovo piano completo (`ProgramInput`). Rifiutato se mancano slot obbligatori |
| `propose_program_changes(programId, operations[], rationale)` | Operazioni atomiche: `swap_exercise`, `add_exercise`, `remove_exercise`, `update_prescription` (serie/reps/RPE/recupero), `add_day`, `remove_day`, `reorder`, `set_deload_week` |

**Validatore deterministico** (`src/lib/coach/proposals/validate.ts`) — il risultato torna al modello come
`tool_result`, così corregge da solo prima che l'utente veda qualcosa:

- esercizi esistenti e utilizzabili (`assertExercisesUsable`);
- nessun esercizio in `dislikedExerciseIds` né incompatibile con gli infortuni (`avoidMovements` ↔ muscoli/tag);
- attrezzatura disponibile;
- numero di giorni = disponibilità, durata stimata della seduta ≤ `sessionMinutes`;
- serie/settimana per muscolo dentro i range per livello (avviso, non blocco);
- vincoli dello schema (`program-schema.ts`).

### Web

`web_search_20260209` (+ `web_fetch_20260209` se serve) con `allowed_domains` limitati a fonti serie
(PubMed, NSCA, ACSM, Stronger by Science, ecc.), `max_uses: 3`. Usato solo per domande specifiche
("che dice la ricerca sul cedimento?"), non per costruire il piano.

### Livelli di autonomia

| Livello | Cosa applica da solo | Cosa chiede sempre |
|---|---|---|
| `ASK_ALWAYS` (default) | nulla | tutto |
| `AUTO_MINOR` | progressioni di carico/reps, swap con esercizio equivalente | nuovi giorni, nuovo piano, deload |
| `AUTO_ALL_EXCEPT_NEW_PLAN` | ogni modifica al piano attivo | creazione/sostituzione del piano |

Ogni applicazione automatica genera notifica + pulsante **Annulla** (ripristino da `ProgramRevision`).

---

## 7. Dati reali: domande sui numeri e cambi di piano

È il vantaggio più concreto del Coach: **conosce ogni tuo numero** e lo spiega bene, anche quando nel frattempo
hai cambiato piano.

### 7.1 Domande sui dati (`query_training_data`)

Il modello non scrive SQL e non fa conti. Sceglie i parametri di una query tipizzata; il server la esegue sui dati
dell'utente della sessione e restituisce numeri finali, definizioni e avvertenze.

**Input (Zod, `strict: true`)**

| Campo | Valori |
|---|---|
| `metric` | `sets` · `reps` · `volume_kg` · `sessions` · `training_time` · `max_weight` · `e1rm` · `prs` · `run_distance` · `run_time` · `run_pace` |
| `period` | preset (`this_week`, `this_month`, `this_year`, `last_n_weeks`, `since_start`, `phase`) oppure `{ from, to }` |
| `filters` | `muscles[]`, `exerciseIds[]`, `workoutTypes[]`, `phaseIds[]` (serie di riscaldamento sempre escluse) |
| `groupBy` | `none` · `week` · `month` · `phase` · `exercise` · `muscle` |

**Output**

```jsonc
{
  "period":  { "from": "2026-01-01", "to": "2026-11-10", "label": "quest'anno" },  // fuso Europe/Rome
  "value":   412, "unit": "serie",
  "detail":  { "direct": 318, "indirect": 188, "indirectWeighted": 94 },
  "perWeek": 9.4,
  "breakdown": [ /* per groupBy */ ],
  "phasesInRange": [ /* blocchi toccati dal periodo, con il valore per ciascuno */ ],
  "definitions": "Serie allenanti, riscaldamento escluso. Dirette: il petto è il muscolo principale. Indirette: muscolo secondario, contate a metà.",
  "coverage": { "firstSession": "2025-12-02", "sessions": 168, "importedWithoutSets": 3 }
}
```

**Esempio di risposta**

> Quest'anno (dal 1° gennaio a oggi) hai fatto **412 serie di petto**: 318 dirette (panca, croci, chest press)
> e 94 indirette (dip e spinte per le spalle, contate a metà). Sono **9,4 serie a settimana**.
>
> ⚠️ A maggio hai cambiato piano, quindi il totale mette insieme due periodi diversi:
> • **Multifrequenza 4x** (gen–apr): 11,2 serie/settimana
> • **Upper/Lower 4x** (da mag): 8,1 serie/settimana
>
> *[grafico settimanale con la linea verticale del cambio piano]*

Regole:
- il periodo interpretato è sempre scritto nella risposta ("dal 1° gennaio a oggi");
- per i muscoli si distinguono sempre serie dirette e indirette, con la regola di conteggio di `muscle-volume.ts`;
- se mancano dati (es. sedute importate dall'orologio senza serie) il Coach lo dice;
- la risposta può includere una **card grafico** (dati del tool → componente Recharts già usato in Fitness);
  il modello non disegna né inventa serie storiche;
- esecuzione: aggregazioni Prisma o `$queryRaw` con parametri tipizzati (mai stringhe concatenate), sempre
  filtrate per `userId`, con un limite sul periodo massimo.

Esempi di domande coperte: *"quanti allenamenti ho fatto a marzo?"*, *"qual è il mio massimale stimato di squat
e come è cambiato?"*, *"quanti km ho corso quest'anno e qual è stata l'uscita più lunga?"*, *"che muscolo alleno di
meno?"*, *"quante ore ho passato in palestra da quando uso l'app?"*.

### 7.2 Cambi di piano: i blocchi di allenamento

**Problema attuale nel codice:** attivare un piano sovrascrive `ActiveProgram` (`upsert` in
`api/programs/active/route.ts`) e disattivarlo lo cancella. Le sedute hanno `programDayId`, ma senza relazione:
se un giorno del piano viene eliminato il collegamento si perde. **Oggi non esiste la storia dei piani.**

**Soluzione: `TrainingPhase` (§5), una funzione dell'app base gratuita per tutti.** Il Coach la sfrutta, ma
serve anche ai grafici di Fitness.

| Evento | Effetto sui blocchi |
|---|---|
| Attivi un piano (nessun blocco aperto) | apre un blocco `PLAN_STARTED` |
| Attivi un piano diverso | chiude il blocco corrente, ne apre uno `PLAN_SWITCHED` |
| Modifica **sostanziale** del piano attivo (giorni aggiunti/tolti, esercizi sostituiti/aggiunti/tolti, split diverso) | chiude e riapre (`PLAN_CHANGED`), con una nuova copia della struttura |
| Modifica **leggera** (serie, ripetizioni, RPE, recuperi, note) | stesso blocco; resta nella `ProgramRevision` |
| Disattivi o elimini il piano | chiude il blocco (`PLAN_STOPPED`) |
| Inizi una seduta | `WorkoutSession.phaseId` = blocco aperto (o `null` se ti alleni senza piano) |

- La regola "sostanziale o leggera" sta in una funzione pura (`phases/significance.ts`), testata.
- Funzione unica `phases/tracker.ts` chiamata da tutti i punti che cambiano il piano: attivazione,
  disattivazione, `updateProgram`, eliminazione, `plan-provisioning.ts` e le proposte del Coach.
- **Recupero dello storico esistente** (migrazione una tantum): `programDayId` → `ProgramDay` → `Program`;
  le sedute consecutive con lo stesso piano formano un blocco `BACKFILL`; quelle senza piano restano "allenamento libero";
  quelle con giorni non più esistenti finiscono in "Piano precedente (non più disponibile)".

**Come il Coach usa i blocchi**

- `query_training_data` restituisce sempre `phasesInRange`. Se sono più di uno, il system prompt *obbliga* a dirlo
  e a dare il dettaglio per blocco.
- Metriche **sempre sommabili** (sedute, serie totali, km, ore): totale + dettaglio per blocco.
- Metriche **legate al piano** (serie per seduta, progresso di un esercizio, aderenza): solo **dentro** ogni blocco.
  Il confronto tra blocchi si fa su medie settimanali normalizzate, mai sui totali grezzi.
- Un esercizio presente solo in un blocco viene segnalato come **non confrontabile** negli altri (flag `comparable: false`
  calcolato dal server).
- Correlazione non è causalità: il Coach può dire "nel blocco Upper/Lower la panca è salita più in fretta",
  non "Upper/Lower funziona meglio per te", a meno che i dati non siano molti e coerenti, e lo dice con cautela.

**Anche nell'app base:** linea verticale "Cambio piano" sui grafici di Fitness e Palestra, e una timeline dei blocchi
nella pagina Piano ("Gen–Apr: Multifrequenza 4x · da Mag: Upper/Lower 4x").

### 7.3 "Com'è andata da quando uso l'app?" (`get_training_story`)

Riepilogo strutturato, calcolato dal server e raccontato dal Coach:

```
Da dicembre 2025 · 11 mesi · 168 allenamenti · 3 blocchi

┌ Blocco 1 · Multifrequenza 4x · dic–apr (20 sett.) ┐
│ 74 sedute · aderenza 92% · petto 11,2 serie/sett.  │
│ Panca 80 → 92,5 kg (e1RM) · 6 record               │
└────────────────────────────────────────────────────┘
┌ Blocco 2 · Upper/Lower 4x · mag–set (19 sett.) ────┐
│ 68 sedute · aderenza 89% · petto 8,1 serie/sett.   │
│ Panca 92,5 → 97,5 kg · squat 110 → 125 kg          │
└────────────────────────────────────────────────────┘
┌ Blocco 3 · PPL 6x · da ottobre (in corso) ─────────┐
│ ...                                                │
└────────────────────────────────────────────────────┘
In totale: panca +17,5 kg, 412 km di corsa, peso corporeo −3 kg
```

Il racconto in chat apre con un **avviso evidente** sui cambi di piano ("Hai seguito 3 piani diversi: li analizzo
uno alla volta, poi ti dico cosa è cambiato tra l'uno e l'altro"), poi il blocco per blocco, poi il totale,
poi 2–3 indicazioni per il futuro. La stessa vista è condivisibile come immagine (riusando `workout-share`).

---

## 8. Intelligenza: prompt e conoscenza

**System prompt** (stabile, cache): ruolo, tono (da impostazioni), lingua italiana, regole:

- prima di proporre un piano verifica gli slot; se ne mancano usa `ask_user` (max 3–4 domande per turno, con opzioni);
- chiedi sempre esercizi preferiti/da evitare e infortuni se il brief è vuoto;
- ogni numero citato deve venire da un tool; il periodo interpretato va sempre scritto;
- se il periodo attraversa più blocchi di allenamento, dirlo all'inizio e dare il dettaglio per blocco (§7.2);
- dolore, infortuni acuti, condizioni mediche → approccio conservativo e invito a un professionista;
- niente indicazioni su farmaci/sostanze, niente diete estreme;
- spiega le scelte in parole semplici (coerente con lo stile "chiarezza prima di tutto" dell'app).

**Knowledge pack** (file in `src/lib/coach/knowledge/`, nel system prompt, versionati):

- principi per stile: Bodybuilding (volume per muscolo, range reps, vicinanza al cedimento), Powerlifting
  (specificità, %1RM/RPE, picco), Running (km settimanali, uscita lunga, polarizzazione, regola del +10%),
  Ibrido (interferenza, ordine delle sedute, carico da battito);
- template di split per frequenza (2–6 giorni) e per tempo disponibile;
- regole di progressione e deload; sostituzioni per infortuni comuni (spalla, ginocchio, lombare).

**Snapshot atleta** (mid-conversation `system`, generato da `context/athlete-snapshot.ts`): sintesi compatta
(~1–2K token) del brief + stato del piano + segnali principali, così il coach parte informato senza
chiamare 5 tool a ogni messaggio.

### Flusso tipo: "creami un piano"

```
Utente: "Voglio mettere massa, mi alleno in palestra"
Coach → get_athlete_overview  (slot mancanti: giorni, durata, infortuni, preferenze)
Coach → ask_user:
   • Quanti giorni a settimana?            [2] [3] [4] [5] [6]
   • Quanto dura una seduta?               [45'] [60'] [75'] [90']
   • Esercizi che ami? / che vuoi evitare? [chip dalla libreria] + testo
   • Fastidi o infortuni?                  [Nessuno] [Spalla] [Ginocchio] [Schiena] [Altro…]
Utente risponde (tap)
Coach → update_athlete_brief → get_muscle_volume → search_exercises
Coach → propose_program  → validatore: "petto 22 serie/sett. oltre il range" → corregge → OK
Card: "Upper/Lower 4 giorni · 8 settimane" + perché + anteprima giorni → [Applica]
Applica → piano creato e attivato → compare in Home e Piano
```

---

## 9. Coach proattivo

| Trigger | Quando | Output |
|---|---|---|
| **Review settimanale** | giorno/ora scelti (cron giornaliero filtra gli utenti del giorno) | messaggio in thread `WEEKLY_REVIEW` + push "La tua settimana: 4/4 sedute, panca +2,5 kg…" ed eventuale proposta di aggiustamento |
| **Dopo l'allenamento** | `POST /sessions/:id/complete` | commento breve (record, confronto con l'ultima volta), in-app; push solo se attivo |
| **Stallo** | `insight-engine` rileva plateau da 3+ settimane | proposta di variazione/deload |
| **Sedute saltate** | 2 sedute pianificate mancate | messaggio di ripianificazione della settimana |
| **Recupero basso** | sonno/FC a riposo/stress fuori norma più giorni (con consenso) | suggerimento di alleggerire |

Implementazione:

- `GET /api/cron/coach` (stesso schema di autorizzazione di `/api/cron/devices`, `CRON_SECRET`), una volta al giorno
  (compatibile con il limite cron del piano Hobby di Vercel).
- Metriche settimanali calcolate in codice → prompt corto → Claude scrive solo il testo.
- Con pochi utenti: chiamate sequenziali nel cron. Oltre ~50 utenti: **Message Batches API** (‑50% di costo),
  con raccolta dei risultati al giro successivo.
- Rispetto di ore silenziose, massimo 1 nudge/giorno, deduplica per tipo.

**Web Push**

- Chiavi VAPID in env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
- `public/sw.js`: handler `push` (mostra notifica) e `notificationclick` (apre `/coach?thread=…`).
- Richiesta del permesso solo dopo un gesto esplicito (toggle nelle impostazioni del coach), mai all'apertura.
- iOS: funziona solo con la PWA aggiunta alla schermata Home (iOS 16.4+) → messaggio guida in UI.
- Subscription scadute (410) eliminate automaticamente.

---

## 10. UX / UI

- **Navigazione:** quinta voce **Coach** al centro della barra in basso (`bottom-nav.tsx`, `grid-cols-5`),
  sempre visibile a tutti. Per chi non è abbonato ha un piccolo segno ✦; per chi lo è, il badge dei messaggi non letti.
  La stessa pagina `/coach` mostra la **pagina di vendita** a chi non ha accesso e la **chat** a chi ce l'ha (§11).
- **Punti d'ingresso contestuali:** "Chiedi al coach" su Piano (modifica), su riepilogo seduta, su un esercizio in stallo,
  e nell'**onboarding** (`/welcome`): dopo la scelta dello stile, "Vuoi che ti prepari io il piano?" → thread `ONBOARDING`.
  Questo risolve direttamente il problema dell'inserimento iniziale. Per chi non è abbonato, gli stessi punti
  portano alla pagina di vendita (§11.4).
- **Chat:** streaming, indicatori di stato dei tool, chip per le risposte rapide, suggerimenti iniziali
  ("Creami un piano", "Come sta andando?", "Ho poco tempo questa settimana", "Sostituisci un esercizio").
- **Card proposta:** riepilogo + diff per giorno (aggiunto/rimosso/modificato, colori), motivazioni,
  pulsanti Applica / Chiedi una modifica / Scarta. Scade se il piano cambia nel frattempo (`SUPERSEDED`).
- **Impostazioni coach** (`/coach/settings`): attivo/off, tono, autonomia, giorno/ora review, notifiche per tipo,
  ore silenziose, consenso dati benessere, **memoria** (brief modificabile), cronologia modifiche al piano con ripristino,
  elimina conversazioni.

---

## 11. Abbonamento: BodyGrowth Coach a 15 €/mese + IVA

### 11.1 Offerta

| | |
|---|---|
| Prodotto | **BodyGrowth Coach**: tutto ciò che è descritto in questo documento |
| Prezzo | **15 € al mese + IVA** (prezzo d'ingresso). In Italia il cliente paga **18,30 €** (IVA 22%) |
| Come si mostra | Ai consumatori UE il prezzo va mostrato **IVA inclusa**: "18,30 € al mese (15 € + IVA)". Negli altri Paesi UE Stripe Tax applica l'IVA locale e il totale esatto compare prima del pagamento |
| Configurazione Stripe | Prezzo 15,00 EUR mensile con `tax_behavior: "exclusive"` + Stripe Tax: a te restano sempre 15 € di ricavo |
| Rinnovo | Mensile automatico, disdetta in qualsiasi momento; resta attivo fino a fine mese pagato |
| Prova gratuita | Nessuna al lancio (vedi §16) |
| Pagamento | **Apple Pay, Google Pay** o carta, tramite Stripe |
| Cosa resta gratis | Tutto il resto dell'app (allenamenti, piani manuali, Fitness, Benessere, dispositivi), senza cambiamenti |

### 11.2 Chi ha accesso

Unica regola, lato server (`src/lib/billing/entitlements.ts`), usata da pagina, API del coach e cron:

```ts
hasCoachAccess(userId):
  userId in COACH_FREE_USER_IDS           → true   // accesso omaggio deciso dal proprietario
  abbonamento ACTIVE | TRIALING           → true
  abbonamento PAST_DUE                    → true per 7 giorni (Stripe ritenta il pagamento)
  CANCELED ma currentPeriodEnd nel futuro → true fino a fine periodo
  altrimenti                              → false
```

- **Accesso omaggio = solo il proprietario.** `COACH_FREE_USER_IDS` è una variabile d'ambiente su Vercel
  con l'**ID utente** (non l'email), separato da virgole. Si cambia senza toccare il codice e non mette dati
  personali nel repository. Si usa l'ID e non l'email perché la registrazione oggi non verifica l'indirizzo email.
- Senza accesso, ogni endpoint `/api/coach/*` risponde `402` e il cron salta l'utente: nessun costo AI
  per chi non paga.
- Il proprietario può vedere la pagina di vendita con `/coach?anteprima=1`.

### 11.3 Flusso di pagamento

```
[Attiva il Coach] ──► POST /api/billing/checkout
                       • utente loggato, non già abbonato, vendite aperte
                       • crea/riusa lo Stripe Customer (metadata.userId)
                       • Checkout Session: mode=subscription, prezzo da env,
                         client_reference_id=userId, automatic_tax, locale "it",
                         consenso ai termini + rinuncia al recesso
                  ◄── url
Pagina Stripe Checkout: Apple Pay (Safari/iPhone) · Google Pay (Chrome/Android) · carta
                  │
                  ├──► Webhook POST /api/billing/webhook (firma verificata, evento deduplicato)
                  │      checkout.session.completed · customer.subscription.created/updated/deleted
                  │      invoice.paid · invoice.payment_failed  →  CoachSubscription
                  │
                  └──► redirect /coach/benvenuto
                         attende che l'accesso risulti attivo (il webhook arriva in pochi secondi)
                         → apre il thread di onboarding: "Iniziamo: qual è il tuo obiettivo?"
```

- **Apple Pay e Google Pay** compaiono da soli nella pagina Checkout di Stripe sui dispositivi compatibili:
  basta attivarli tra i metodi di pagamento della dashboard Stripe. Con il Checkout ospitato da Stripe non serve
  verificare il dominio per Apple Pay; servirà solo se un domani si porta il pagamento dentro la pagina dell'app
  (Express Checkout Element).
- **Gestione:** Profilo › Impostazioni › **Abbonamento**: stato, prossimo rinnovo, "Gestisci" che apre lo
  Stripe Customer Portal (disdetta, cambio carta, ricevute).
- **Pagamento non riuscito:** banner "Aggiorna il metodo di pagamento"; Stripe ritenta e manda l'email.
  Dopo 7 giorni l'accesso si sospende. Conversazioni e memoria restano: chi si riabbona riprende da dove era.
- **Uso equo:** budget AI mensile interno per abbonato (~8 €, circa 80 domande intense) per proteggere il margine. Oltre quel budget
  le risposte rallentano, con un messaggio chiaro e senza blocchi improvvisi. Un uso normale non lo raggiunge mai.

### 11.4 Dove si vede (per invogliare senza infastidire)

| Punto | Cosa vede chi non è abbonato |
|---|---|
| **Barra in basso: voce Coach ✦** (sempre visibile) | Pagina di vendita completa (§11.5) |
| **Onboarding** (`/welcome`), dopo la scelta dello stile | Due scelte: "Fammi il piano con il Coach" (18,30 €/mese IVA incl.) · "Lo creo io" |
| **Fitness, sotto un grafico** | "Chiedilo al Coach: *quante serie di petto ho fatto quest'anno?*" |
| **Piano vuoto / nuovo piano** | "Non hai voglia di compilarlo? Il Coach te lo prepara in pochi minuti." |
| **Esercizio in stallo** (insight esistente) | "Panca piana ferma da 3 settimane. Il Coach sa come sbloccarla." |
| **Fitness › Riepilogo** | "Ogni lunedì una review della tua settimana, scritta per te." |
| **Profilo › Impostazioni** | Riga "Abbonamento: BodyGrowth Coach" |

Regole:
- al massimo un invito per schermata, sempre chiudibile, e se chiuso non ricompare per 14 giorni;
- **mai durante un allenamento in corso**;
- gli inviti usano numeri veri dell'utente, calcolati in codice e senza costo AI
  (es. "Hai registrato 14 allenamenti nelle ultime 4 settimane").

### 11.5 Pagina di vendita: testi

> **Il tuo personal trainer. Sempre con te.**
> Dimmi cosa vuoi ottenere: il Coach legge i tuoi allenamenti, ti fa le domande giuste e ti prepara il piano.
> Poi ti segue, settimana dopo settimana.
>
> *(se l'utente ha dati)* Hai registrato **14 allenamenti** nelle ultime 4 settimane. Il Coach può leggerli e dirti
> dove stai migliorando e dove no.

**Cosa fa per te**

| | |
|---|---|
| **Ti crea il piano in pochi minuti** | Niente schede da compilare: rispondi a qualche domanda e il piano è pronto, con esercizi, serie e recuperi. |
| **Ti conosce davvero** | Legge allenamenti, record, corse, sonno e battito. Sa cosa ti piace, cosa eviti e dove hai fastidi. |
| **Conosce ogni tuo numero** | "Quante serie di petto ho fatto quest'anno?" "Quanti km ho corso a ottobre?" Chiedi e ti risponde con i tuoi dati veri, anche con un grafico. |
| **Ricorda tutta la tua storia** | Sa quando hai cambiato piano e ti dice cosa ha funzionato in ogni periodo, senza mischiare le cose. |
| **Fa le domande giuste** | Se manca qualcosa (quanti giorni, quanto tempo, che attrezzatura) te lo chiede prima di decidere. |
| **Aggiorna il piano quando serve** | Stallo, settimana piena, esercizio che non ti va: ti propone la modifica e tu approvi con un tocco. Puoi sempre tornare indietro. |
| **Ogni lunedì la tua review** | Com'è andata, cosa è migliorato, cosa fare la settimana dopo. Ti arriva con una notifica. |
| **Ti risponde quando vuoi** | Dubbi su un esercizio, sul recupero, sulla corsa: chiedi in chat, come a un personal trainer. |

**Come funziona**
1. Dimmi il tuo obiettivo.
2. Rispondi a qualche domanda.
3. Approvi il piano e ti alleni: il resto lo segue il Coach.

**Cosa gli serve:** i dati che registri già nell'app. Più ti alleni con BodyGrowth, più è preciso.
Sonno e battito li usa solo se gli dai il permesso.

**Box prezzo**
> **18,30 € al mese** · IVA inclusa (15 € + IVA)
> Meno di una lezione con un personal trainer, per un mese intero.
> Disdici quando vuoi, in due tocchi.
>
> **[ Attiva il Coach ]**
> Paga con Apple Pay, Google Pay o carta

**Domande frequenti**
- *Posso disdire quando voglio?* Sì, da Impostazioni › Abbonamento. Il Coach resta attivo fino alla fine del mese già pagato.
- *Cambia il piano senza chiedermelo?* No, a meno che tu non lo permetta nelle impostazioni. Di base chiede sempre.
- *I miei dati sono al sicuro?* Servono solo per seguirti. Sonno e battito li usa solo con il tuo consenso. Non vengono usati per addestrare modelli.
- *Funziona anche per la corsa?* Sì: bodybuilding, powerlifting, corsa e allenamento ibrido.
- *Sostituisce un medico o un fisioterapista?* No. Se segnali dolore o un infortunio, ti consiglia di sentire un professionista.

**Prima dell'apertura delle vendite** (`COACH_SALES_ENABLED=false`) la pagina è la stessa, ma il pulsante diventa
**"Avvisami quando è disponibile"** (lista d'attesa). Non si incassa per un servizio che non c'è ancora,
e intanto si misura l'interesse reale.

### 11.6 Conti per abbonato (stima mensile)

**Costo AI per "chiamata"** (un tuo messaggio + la risposta completa del Coach, tool compresi).
Opus 5.5: input 4 $/M token, output 20 $/M, lettura da cache 0,20 $/M, scrittura in cache 5 $/M. Cambio ipotizzato 1 $ ≈ 0,90 €.

| Tipo di chiamata | Cosa succede | Costo |
|---|---|---|
| Domanda sui dati o consiglio | 2 richieste al modello (tool + risposta), ~1.200 token in uscita | ~0,05 $ |
| Modifica del piano | 3–4 richieste, proposta + validazione | ~0,12 $ |
| Creazione di un piano completo | 5–6 richieste, piano intero + correzioni | ~0,35 $ |
| Prima domanda dopo una pausa | la cache è scaduta e va riscritta | +0,07 $ |

**Utente intenso: 50 chiamate al mese** (40 domande, 8 modifiche, 2 piani nuovi, ~20 sessioni separate),
più le funzioni automatiche (4 review settimanali, ~16 commenti dopo l'allenamento):

| Voce | $ |
|---|---|
| 40 domande × 0,05 | 2,00 |
| 8 modifiche × 0,12 | 0,96 |
| 2 piani × 0,35 | 0,70 |
| 20 ripartenze a cache fredda × 0,07 | 1,40 |
| Review + commenti automatici | 0,48 |
| **Totale** | **~5,50 $ ≈ 5 €** (prudenziale +30%: **~6,50 €**) |

**Guadagno per abbonato (Italia)**

| Voce | Utente intenso (50 chiamate) | Utente tipico (~15 chiamate) |
|---|---|---|
| Pagato dal cliente | 18,30 | 18,30 |
| IVA 22% (allo Stato) | −3,30 | −3,30 |
| **Ricavo** | **15,00** | **15,00** |
| Stripe (carta EU 1,5% + 0,25 €, Billing 0,7%, Tax 0,5%) | −0,75 | −0,75 |
| Costo AI | −5,00 (prudenziale −6,50) | −1,50 / −2,00 |
| **Margine per utente** | **~9,25 €** (prudenziale **~7,75 €**) | **~12,25–12,75 €** |
| Caso limite (budget di uso equo da 8 € esaurito) | ~6,25 € | — |

Anche l'utente più intenso resta ampiamente in attivo: oltre il 50% del ricavo.

**Proiezione** (mix 70% utenti tipici, 30% intensi ≈ 11,50 € di margine medio):

| Abbonati | Margine mensile | Costi fissi | Netto mensile (prima delle imposte sul reddito) |
|---|---|---|---|
| 10 | ~115 € | ~40 € | ~75 € |
| 100 | ~1.150 € | ~40 € | ~1.110 € |
| 500 | ~5.750 € | ~80 € | ~5.670 € |

- **Costi fissi:** il piano Hobby di Vercel non permette l'uso commerciale. Per vendere serve **Vercel Pro**
  (~20 $/mese) e, con più utenti, un piano a pagamento di Neon (~19 $/mese).
- Le carte extra-UE costano di più su Stripe (circa 2,5–3,25%): impatto trascurabile.
- Le imposte sul reddito dipendono dal tuo regime fiscale (forfettario o altro): da chiedere al commercialista.
- Sugli store (§11.8) la commissione del 15% si calcola sul prezzo senza IVA: −2,25 € per abbonato.
- Le stime vanno verificate con i consumi reali: ogni messaggio registra i token usati (`CoachMessage.usage`)
  e una dashboard interna mostra costo e margine per utente.

### 11.7 Prerequisiti non tecnici (da verificare con il commercialista)

- Soggetto che incassa (partita IVA o società) e account Stripe verificato a suo nome.
- Termini di vendita. Per i servizi digitali che partono subito, il consumatore perde il diritto di recesso
  di 14 giorni solo con consenso esplicito: va una casella apposita nel Checkout.
- Informativa privacy aggiornata con Stripe e Anthropic come fornitori.
- IVA: Stripe Tax calcola l'imposta per Paese; gli adempimenti (OSS, corrispettivi/fatture) vanno impostati col commercialista.

### 11.8 Futuro: App Store e Google Play

- Dentro un'app iOS, gli abbonamenti digitali devono passare per l'**acquisto in-app di Apple** (linea guida 3.1.1),
  salvo le eccezioni per Paese (es. link esterni negli USA, condizioni alternative UE). Su Google Play vale una regola
  analoga con Play Billing. Apple Pay nel web e acquisto in-app sono due cose diverse.
- Per questo `CoachSubscription` ha il campo `provider` e `hasCoachAccess` non sa da dove arriva il pagamento.
  Si aggiungerà **RevenueCat** (StoreKit + Play Billing) con i suoi webhook verso la stessa tabella.
- Le commissioni degli store (15% con lo Small Business Program) vanno messe in conto.
  Chi si è abbonato dal web potrà accedere anche dall'app con lo stesso account, purché l'acquisto sia offerto
  anche in-app (regole da ricontrollare al momento della pubblicazione).

---

## 12. Sicurezza, privacy, costi

**Sicurezza**

- `ANTHROPIC_API_KEY` solo server; nessuna chiamata dal client.
- `userId` sempre dalla sessione NextAuth; i tool non accettano id utente.
- Prompt injection (note, nomi esercizi custom, pagine web): il modello non ha tool di scrittura diretta,
  le proposte sono ri-validate all'applicazione, i contenuti esterni sono marcati come dati.
- Rate limiting per utente (messaggi/minuto e budget token/giorno) — tabella usage o contatore su `CoachMessage.usage`.
- Limite iterazioni del loop e `max_tokens` per risposta; timeout coerente con `maxDuration`.
- Endpoint cron protetti con `CRON_SECRET` (come quello esistente).
- Pagamenti: nessun dato di carta sui nostri server (Checkout ospitato da Stripe). Webhook con firma verificata
  (`STRIPE_WEBHOOK_SECRET`, body grezzo) e idempotenti (`BillingEvent`). Il prezzo si legge dall'env, mai dal client.
  L'accesso non si attiva mai dalla pagina di ritorno.
- Chiavi `STRIPE_SECRET_KEY` e `ANTHROPIC_API_KEY` solo nelle variabili d'ambiente di Vercel; chiavi di test
  in Preview e chiavi live solo in Production.

**Privacy (GDPR)**

- Dati di salute (sonno, battito, stress) = categoria particolare: consenso esplicito separato prima di inviarli al modello;
  senza consenso il tool `get_recovery_summary` è disabilitato.
- Informativa: i dati vengono elaborati da Anthropic come fornitore; nessun uso per addestramento sull'API commerciale.
- Export e cancellazione: aggiungere thread, brief e proposte a `/api/user/data` (export/eliminazione esistenti).
- Disclaimer: il coach non sostituisce medico/fisioterapista.

**Costi (ordine di grandezza, Opus 5.5: $4 / $20 per MTok, cache read $0,20)**

| Operazione | Stima |
|---|---|
| Messaggio di chat (system+tool in cache, 1–2 tool) | ~$0,05 (dettaglio al §11.6) |
| Creazione piano completo (più tool + validazione) | ~$0,15–0,40 |
| Review settimanale (prompt corto) | ~$0,02; ~$0,01 con Batch |

Leve: prompt caching (fondamentale), snapshot compatto, effort `medium` in chat, Batch per i job.
Ricavi e margine per abbonato: §11.6.

---

## 13. Struttura del codice

```
src/lib/coach/
  client.ts                  # istanza Anthropic, modello, effort per tipo di richiesta
  system-prompt.ts
  knowledge/                 # bodybuilding.ts, powerlifting.ts, running.ts, hybrid.ts, splits.ts, injuries.ts
  context/athlete-snapshot.ts
  context/required-slots.ts  # quali informazioni mancano
  tools/
    index.ts                 # registro tool + dispatcher
    read-tools.ts
    memory-tools.ts
    ask-user.ts
    proposal-tools.ts
  loop.ts                    # loop agente → async generator di eventi SSE
  proposals/validate.ts
  proposals/diff.ts
  proposals/apply.ts         # transazione: revision + program-writer
  proactive/weekly-review.ts
  proactive/nudges.ts
  data/query.ts              # query tipizzata per query_training_data
  data/periods.ts            # preset di periodo → date (Europe/Rome)
  data/story.ts              # riepilogo blocco per blocco
  push/web-push.ts
  usage.ts                   # rate limit e budget

src/app/api/coach/
  chat/route.ts              # POST, SSE
  threads/route.ts           # GET lista, POST nuovo
  threads/[id]/route.ts      # GET messaggi, DELETE
  proposals/[id]/apply/route.ts
  proposals/[id]/reject/route.ts
  revisions/[id]/restore/route.ts
  settings/route.ts
  brief/route.ts
  access/route.ts            # GET stato accesso (per la pagina di benvenuto)
  waitlist/route.ts          # POST lista d'attesa
src/app/api/push/subscribe/route.ts
src/app/api/cron/coach/route.ts

src/lib/phases/               # app base, gratis per tutti
  tracker.ts                 # apre/chiude i blocchi a ogni cambio di piano
  significance.ts            # modifica sostanziale o leggera
  backfill.ts                # ricostruisce lo storico dalle sedute esistenti

src/lib/billing/
  stripe.ts                  # client Stripe, prezzo da env
  entitlements.ts            # hasCoachAccess, requireCoachAccess (402)
  sync-subscription.ts       # evento Stripe → CoachSubscription (+ subscriptionTier)
src/app/api/billing/
  checkout/route.ts          # POST → URL Stripe Checkout
  portal/route.ts            # POST → URL Customer Portal
  webhook/route.ts           # POST, runtime nodejs, firma verificata

src/app/(dashboard)/coach/page.tsx            # accesso ? chat : pagina di vendita
src/app/(dashboard)/coach/benvenuto/page.tsx  # dopo il pagamento
src/app/(dashboard)/coach/[threadId]/page.tsx
src/app/(dashboard)/coach/settings/page.tsx

src/components/coach/
  chat-view.tsx  message-bubble.tsx  composer.tsx  tool-status.tsx
  ask-user-chips.tsx  proposal-card.tsx  proposal-diff.tsx
  coach-settings-form.tsx  brief-editor.tsx  revision-history.tsx
src/components/coach/paywall/
  coach-paywall.tsx  feature-grid.tsx  price-card.tsx  faq.tsx
  coach-teaser.tsx           # invito contestuale chiudibile (§11.4)
src/components/profile/subscription-card.tsx
src/hooks/use-coach-chat.ts  # fetch + ReadableStream, stato messaggi
```

Variabili d'ambiente nuove (da aggiungere a `.env.example`):
`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_COACH_MONTHLY`,
`COACH_FREE_USER_IDS`, `COACH_SALES_ENABLED`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

---

## 14. Roadmap a fasi

Ogni fase è rilasciabile da sola. Dalla Fase 0 il Coach è protetto da `hasCoachAccess`: lo usa solo il proprietario
(`COACH_FREE_USER_IDS`) finché le vendite non si aprono.

### Fase 0 — Fondamenta e abbonamento (4–5 gg)
- `@anthropic-ai/sdk`, env (`ANTHROPIC_API_KEY`), `client.ts`.
- Migrazione Prisma (§5, incluse `CoachSubscription`, `BillingEvent`, `CoachWaitlist`), schermata consenso.
- **Blocchi di allenamento** (§7.2) per tutti: `TrainingPhase`, `phaseId` sulle sedute, tracker su ogni cambio
  di piano, recupero dello storico, linea "Cambio piano" sui grafici di Fitness. Va fatto per primo perché da quel
  momento la storia si registra correttamente.
- Stripe in modalità test: prodotto "BodyGrowth Coach", prezzo 15 € mensile + IVA (`tax_behavior: exclusive`), Apple Pay/Google Pay attivi,
  Stripe Tax, Customer Portal.
- `entitlements.ts`, checkout, webhook, portal, card Abbonamento nel profilo.
- Voce **Coach ✦** in navigazione con la pagina di vendita (§11.5) e la lista d'attesa (`COACH_SALES_ENABLED=false`).
- Test: regole di accesso, webhook (firma, duplicati, ogni stato), checkout con carte di test Stripe.
- Harness di valutazione vuoto (§15).

### Fase 1 — Coach che legge e risponde (4–5 gg)
- Loop agente + SSE + UI chat + thread persistenti.
- Tool di lettura, `search_exercises`, `update_athlete_brief`, `ask_user`.
- Snapshot atleta, knowledge pack v1, caching.
- Chat al posto della pagina di vendita per chi ha accesso.
- ✅ Risultato: "come sto andando?", "perché la panca è ferma?" con numeri reali.

### Fase 2 — Creazione del piano (5–6 gg) ← risolve il problema principale
- Slot obbligatori, `propose_program`, validatore, card proposta con anteprima, applica/attiva.
- `ProgramRevision` + ripristino.
- Ingresso dall'onboarding (`/welcome`) e da Piano vuoto.
- ✅ Risultato: dalla registrazione al piano attivo in pochi minuti, senza builder.

### 🚀 Apertura vendite (dopo la Fase 2)
Quando creazione del piano ed eval sono stabili:
- chiavi Stripe live in Production, `COACH_SALES_ENABLED=true`;
- inviti contestuali attivi (§11.4), email/notifica a chi è in lista d'attesa;
- prerequisiti del §11.7 completati.

Le fasi 3 e 4 arrivano come aggiornamenti per chi è già abbonato.

### Fase 3 — Modifica e adattamento (4–5 gg)
- `propose_program_changes` (swap, prescrizioni, giorni, deload) con diff.
- Livelli di autonomia + applicazione automatica con annulla.
- "Chiedi al coach" contestuale su Piano, seduta, esercizio.

### Fase 4 — Coach proattivo (4–5 gg)
- Web Push (VAPID, `sw.js`, subscribe, impostazioni).
- Cron `/api/cron/coach`: review settimanale, commento post-seduta, nudge (stallo, sedute saltate, recupero).
- Impostazioni complete (tono, orari, ore silenziose, tipi di notifica).

### Fase 5 — Evoluzioni
- Input vocale (Web Speech API) per parlare al coach in palestra.
- **Server MCP di BodyGrowth**: espone gli stessi tool (lettura + proposte) per usare il proprio coach anche da
  Claude/altri client, con OAuth per utente.
- Piano annuale, prova gratuita, codici sconto (Stripe li supporta già).
- Batch API per i job, web search sulle domande di approfondimento.
- Periodizzazione multi-blocco (mesociclo → nuovo piano proposto a fine ciclo, usando `plan-cycle.ts`).

### Fase 6 — App Store e Google Play
- App nativa o wrapper della PWA, acquisti in-app tramite RevenueCat → stessa `CoachSubscription` (§11.8).

**Totale fino all'apertura vendite (Fasi 0–2): ~3 settimane; completo (0–4): ~6 settimane** per una persona.

---

## 15. Qualità: valutazione e test

**Eval set** (~30 scenari, eseguito prima di ogni cambio di prompt/modello):

- richiesta incompleta → deve chiedere gli slot mancanti, non proporre;
- esercizio "odiato" → mai presente nel piano;
- infortunio alla spalla → niente movimenti sopra la testa a carico, invito al professionista se dolore acuto;
- piano generato → passa il validatore al primo o secondo tentativo;
- numeri nella risposta = numeri restituiti dai tool;
- domande sui dati ("serie di petto quest'anno", "km a ottobre", "massimale di squat") su un utente di test con risultati noti: risposta esatta;
- periodo che attraversa un cambio di piano → avviso esplicito e dettaglio per blocco, nessun confronto tra esercizi non presenti in entrambi;
- risposta in italiano, tono coerente con l'impostazione;
- contenuto malevolo in una nota → nessuna azione fuori dalle proposte.

**Test automatici** (Jest, come il resto di `src/lib`): blocchi (apertura/chiusura per ogni evento, modifica sostanziale vs leggera, backfill),
query dei dati (periodi, fuso orario, serie dirette/indirette, isolamento per utente), validatore, diff, apply/restore, slot obbligatori,
dispatcher dei tool con input non validi, rate limit, cron (autorizzazione, ore silenziose, deduplica),
regole di accesso (omaggio, attivo, past_due con tolleranza, disdetto a fine periodo, scaduto), webhook Stripe.
Playwright: pagina di vendita → Checkout di test → benvenuto → onboarding → piano applicato.

---

## 16. Decisioni

| Decisione | Stato |
|---|---|
| Coach a pagamento | ✅ Deciso: funzione a pagamento, nessuna versione gratuita |
| Prezzo | ✅ Deciso: **15 €/mese + IVA** come prezzo d'ingresso (18,30 € IVA inclusa in Italia) |
| Domande sui dati | ✅ Deciso: il Coach risponde con i numeri reali su ogni metrica (§7.1) |
| Cambi di piano | ✅ Deciso: storia in blocchi, sempre segnalati e confrontati in modo corretto (§7.2) |
| Accesso omaggio | ✅ Deciso: solo il proprietario (`COACH_FREE_USER_IDS`) |
| Pagamenti | ✅ Deciso: Stripe Checkout con Apple Pay, Google Pay e carta |
| Posizione | ✅ Deciso: quinta voce centrale "Coach ✦" + inviti contestuali (§11.4) |
| Modello | Raccomandato: `claude-opus-5-5` ovunque; un modello più economico per le review solo dopo l'eval |
| Autonomia predefinita | Raccomandato: `ASK_ALWAYS` finché l'eval non è stabile |
| Prova gratuita | Raccomandato: nessuna al lancio; valutare 7 giorni dopo aver misurato la conversione |
| Piano annuale | Raccomandato: dopo il lancio (es. 96 €/anno, cioè 2 mesi in regalo) |
| Web search | Raccomandato: attiva, limitata a domini selezionati, solo sulle domande di approfondimento |
