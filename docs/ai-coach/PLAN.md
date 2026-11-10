# Coach AI — Piano di progetto

> Un personal trainer conversazionale dentro BodyGrowth: legge i tuoi dati, fa le domande giuste,
> crea e modifica il piano su tua autorizzazione, ti segue nel tempo e ti scrive ogni settimana.

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
5. ti segue: review settimanale, commento dopo l'allenamento, avvisi su stallo/sovraccarico, via chat e notifica push.

**Metriche di successo**

| Metrica | Target |
|---|---|
| Tempo dalla registrazione al primo piano attivo | < 5 minuti |
| % proposte del coach applicate | > 60% |
| Utenti con piano attivo a 30 giorni | +50% rispetto a oggi |
| Aderenza (sedute fatte / pianificate) di chi usa il coach | > chi non lo usa |

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
6. **Rispetto delle decisioni prese.** Nel flusso di allenamento non ci sono consigli di carico (commit
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

## 7. Intelligenza: prompt e conoscenza

**System prompt** (stabile, cache): ruolo, tono (da impostazioni), lingua italiana, regole:

- prima di proporre un piano verifica gli slot; se ne mancano usa `ask_user` (max 3–4 domande per turno, con opzioni);
- chiedi sempre esercizi preferiti/da evitare e infortuni se il brief è vuoto;
- ogni numero citato deve venire da un tool;
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

## 8. Coach proattivo

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

## 9. UX / UI

- **Navigazione:** quinta voce **Coach** al centro della barra in basso (`bottom-nav.tsx`, `grid-cols-5`),
  icona dedicata, badge per messaggi non letti.
- **Punti d'ingresso contestuali:** "Chiedi al coach" su Piano (modifica), su riepilogo seduta, su un esercizio in stallo,
  e nell'**onboarding** (`/welcome`): dopo la scelta dello stile, "Vuoi che ti prepari io il piano?" → thread `ONBOARDING`.
  Questo risolve direttamente il problema dell'inserimento iniziale.
- **Chat:** streaming, indicatori di stato dei tool, chip per le risposte rapide, suggerimenti iniziali
  ("Creami un piano", "Come sta andando?", "Ho poco tempo questa settimana", "Sostituisci un esercizio").
- **Card proposta:** riepilogo + diff per giorno (aggiunto/rimosso/modificato, colori), motivazioni,
  pulsanti Applica / Chiedi una modifica / Scarta. Scade se il piano cambia nel frattempo (`SUPERSEDED`).
- **Impostazioni coach** (`/coach/settings`): attivo/off, tono, autonomia, giorno/ora review, notifiche per tipo,
  ore silenziose, consenso dati benessere, **memoria** (brief modificabile), cronologia modifiche al piano con ripristino,
  elimina conversazioni.

---

## 10. Sicurezza, privacy, costi

**Sicurezza**

- `ANTHROPIC_API_KEY` solo server; nessuna chiamata dal client.
- `userId` sempre dalla sessione NextAuth; i tool non accettano id utente.
- Prompt injection (note, nomi esercizi custom, pagine web): il modello non ha tool di scrittura diretta,
  le proposte sono ri-validate all'applicazione, i contenuti esterni sono marcati come dati.
- Rate limiting per utente (messaggi/minuto e budget token/giorno) — tabella usage o contatore su `CoachMessage.usage`.
- Limite iterazioni del loop e `max_tokens` per risposta; timeout coerente con `maxDuration`.
- Endpoint cron protetti con `CRON_SECRET` (come quello esistente).

**Privacy (GDPR)**

- Dati di salute (sonno, battito, stress) = categoria particolare: consenso esplicito separato prima di inviarli al modello;
  senza consenso il tool `get_recovery_summary` è disabilitato.
- Informativa: i dati vengono elaborati da Anthropic come fornitore; nessun uso per addestramento sull'API commerciale.
- Export e cancellazione: aggiungere thread, brief e proposte a `/api/user/data` (export/eliminazione esistenti).
- Disclaimer: il coach non sostituisce medico/fisioterapista.

**Costi (ordine di grandezza, Opus 5.5: $4 / $20 per MTok, cache read $0,20)**

| Operazione | Stima |
|---|---|
| Messaggio di chat (system+tool in cache, 1–2 tool) | ~$0,02–0,05 |
| Creazione piano completo (più tool + validazione) | ~$0,15–0,40 |
| Review settimanale (prompt corto) | ~$0,02; ~$0,01 con Batch |

Leve: prompt caching (fondamentale), snapshot compatto, effort `medium` in chat, Batch per i job.
Il campo `SubscriptionTier` esistente permette limiti per piano (es. FREE: review settimanale + N messaggi/mese).

---

## 11. Struttura del codice

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
src/app/api/push/subscribe/route.ts
src/app/api/cron/coach/route.ts

src/app/(dashboard)/coach/page.tsx
src/app/(dashboard)/coach/[threadId]/page.tsx
src/app/(dashboard)/coach/settings/page.tsx

src/components/coach/
  chat-view.tsx  message-bubble.tsx  composer.tsx  tool-status.tsx
  ask-user-chips.tsx  proposal-card.tsx  proposal-diff.tsx
  coach-settings-form.tsx  brief-editor.tsx  revision-history.tsx
src/hooks/use-coach-chat.ts  # fetch + ReadableStream, stato messaggi
```

---

## 12. Roadmap a fasi

Ogni fase è rilasciabile da sola, dietro feature flag (`COACH_ENABLED` + allowlist utenti all'inizio).

### Fase 0 — Fondamenta (2–3 gg)
- `@anthropic-ai/sdk`, env (`ANTHROPIC_API_KEY`), `client.ts`.
- Migrazione Prisma (§5), feature flag, schermata consenso.
- Harness di valutazione vuoto (§13).

### Fase 1 — Coach che legge e risponde (4–5 gg)
- Loop agente + SSE + UI chat + thread persistenti.
- Tool di lettura, `search_exercises`, `update_athlete_brief`, `ask_user`.
- Snapshot atleta, knowledge pack v1, caching.
- Voce **Coach** nella navigazione.
- ✅ Risultato: "come sto andando?", "perché la panca è ferma?" con numeri reali.

### Fase 2 — Creazione del piano (5–6 gg) ← risolve il problema principale
- Slot obbligatori, `propose_program`, validatore, card proposta con anteprima, applica/attiva.
- `ProgramRevision` + ripristino.
- Ingresso dall'onboarding (`/welcome`) e da Piano vuoto.
- ✅ Risultato: dalla registrazione al piano attivo in pochi minuti, senza builder.

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
- Limiti per `SubscriptionTier`, Batch API per i job, web search sulle domande di approfondimento.
- Periodizzazione multi-blocco (mesociclo → nuovo piano proposto a fine ciclo, usando `plan-cycle.ts`).

**Totale MVP (Fasi 0–2): ~2–3 settimane; completo (0–4): ~5–6 settimane** per una persona.

---

## 13. Qualità: valutazione e test

**Eval set** (~30 scenari, eseguito prima di ogni cambio di prompt/modello):

- richiesta incompleta → deve chiedere gli slot mancanti, non proporre;
- esercizio "odiato" → mai presente nel piano;
- infortunio alla spalla → niente movimenti sopra la testa a carico, invito al professionista se dolore acuto;
- piano generato → passa il validatore al primo o secondo tentativo;
- numeri nella risposta = numeri restituiti dai tool;
- risposta in italiano, tono coerente con l'impostazione;
- contenuto malevolo in una nota → nessuna azione fuori dalle proposte.

**Test automatici** (Jest, come il resto di `src/lib`): validatore, diff, apply/restore, slot obbligatori,
dispatcher dei tool con input non validi, rate limit, cron (autorizzazione, ore silenziose, deduplica).
Playwright: flusso onboarding → piano applicato.

---

## 14. Decisioni aperte (con raccomandazione)

| Decisione | Raccomandazione |
|---|---|
| Modello | `claude-opus-5-5` ovunque; valutare un modello più economico solo per le review settimanali dopo l'eval |
| Autonomia predefinita | `ASK_ALWAYS` finché l'eval non è stabile |
| Coach gratis o a pagamento | Gratis in beta con budget mensile; poi limiti per `SubscriptionTier` |
| Posizione in navigazione | Quinta voce centrale "Coach" |
| Web search | Attiva ma limitata a domini selezionati, solo su domande di approfondimento |
