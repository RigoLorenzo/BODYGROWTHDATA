# Design — Piano di miglioramento

> Dalla revisione del design dell'11 novembre 2026 (12 schermate, formato iPhone, utente di prova con palestra,
> corsa e due piani). Ispirazione: **Strava** (motivazione, obiettivi, momento dopo l'attività) e **Runna**
> (piani di corsa con obiettivo, "cosa fare oggi"). Ispirazione nelle meccaniche, non nell'aspetto: BodyGrowth
> mantiene la sua identità (titoli condensati, card scura, verde lime).

---

## 1. Obiettivo

Oggi l'app **registra bene** quello che fai; il passo successivo è **dirti cosa fare e farti venire voglia di farlo**.

| Problema principale | Dove | Fase |
|---|---|---|
| Il piano esiste solo per la palestra: chi corre non ha "cosa fare oggi" | Piano, Home | 4 |
| Durante l'allenamento l'app distrae (menu visibile, "Fine" in evidenza da subito) | Allenamento | 2 |
| A inizio periodo l'app mostra perdite (frecce rosse, zeri) invece di avanzamento | Fitness | 0, 3 |
| Colori e pulsanti principali senza una regola unica | Ovunque | 1 |

**Cosa c'è già e va valorizzato, non rifatto:**
- "L'ultima volta" per ogni serie (`set-row.tsx`, `lastTimeLabel` in `exercise-card.tsx`): esiste, ma è nascosto nell'esercizio chiuso.
- Riepilogo di fine seduta con il numero di record (`workout-summary-card.tsx`).
- Obiettivo settimanale di km (`Profile.weeklyRunKmGoal`, barra in `run-period.tsx`): solo nella scheda Corsa.
- `Goal.weeklyFrequency` nel database: un obiettivo di sedute a settimana già previsto e mai mostrato.
- Dettaglio corsa con mappa e intertempi, Forma (stanco/fresco) in Benessere.

**Come si misura il successo**

| Metrica | Target |
|---|---|
| Sedute completate sul totale avviate | +10% |
| Utenti con un obiettivo settimanale impostato | > 50% |
| Settimane con obiettivo raggiunto | misurata da subito, poi in crescita |
| Utenti Corsa/Ibrido con un piano di corsa attivo (dopo la Fase 4) | > 40% |

---

## 2. Fasi

### Fase 0 — Correzioni rapide (1 giorno)

| Intervento | File | Dettaglio |
|---|---|---|
| Confronto del passo sbagliato | `src/components/run/run-period.tsx` (metrica `PACE`) e il calcolo delle differenze in `src/components/analytics/period-metrics.tsx` | Senza km il passo vale 0 e il confronto mostra "↘ −315 sec" in verde. Nessun confronto se uno dei due periodi non ha dati (vale per ogni metrica con `lowerIsBetter`) |
| Frecce rosse a inizio periodo | `period-metrics.tsx` | Per il periodo in corso: freccia **grigia** finché siamo nella prima metà del periodo, rossa solo dopo. Mai rosso quando il valore attuale è 0 e il periodo è appena iniziato |
| Titolo "ALLENAMENTO" doppio | `src/components/profile/settings-form.tsx` | La seconda sezione diventa "Durante l'allenamento" |
| Nome inglese nell'allenamento | `src/components/session/exercise-card.tsx` | Nome italiano (`nameIt`) come principale, inglese sotto, come in Home e Piano |
| Etichette del menu a 10 px | `src/components/layout/bottom-nav.tsx` | 11 px (`text-[11px]`); con 5 voci c'è spazio |
| Icone senza nome nel Coach | `src/components/coach/coach-chat.tsx` | Etichetta visibile sotto le icone, oppure un menu "⋯" con le voci scritte |
| Riquadro vuoto alto 150 px | `period-metrics.tsx` | Stato vuoto compatto (una riga + azione: "Registra un allenamento") |

**Verifica:** test unitari sulla regola dei confronti (dati mancanti, inizio periodo, `lowerIsBetter`);
screenshot prima/dopo delle schede Fitness a inizio mese.

### Fase 1 — Regole di design (2–3 giorni)

Un piccolo sistema, scritto in codice e in `docs/design/SYSTEM.md`, così ogni schermata nuova è coerente.

**Colori con un significato** (variabili in `src/app/globals.css`, nomi in `tailwind.config.ts`):

| Token | Uso | Oggi |
|---|---|---|
| `brand` (verde lime) | **Solo** l'azione "allenati adesso" e il progresso verso un obiettivo | Lime usato in 57 punti con significati diversi |
| `primary` (nero / bianco in scuro) | Le altre azioni principali (salva, invia, applica) | Già così |
| `success` | Completato, record, obiettivo raggiunto | `green-600` sparso |
| `warning` / `destructive` | Avvisi / eliminazioni | Già così |

- Per il testo verde su fondo chiaro si usa la tonalità scura del lime (contrasto ≥ 4,5:1); il lime chiaro solo come fondo o su scuro.
- Rimpiazzo dei colori scritti a mano (`lime-500`, `green-600`) con i token, file per file.

**Componenti condivisi** (in `src/components/ui/`):
- `PrimaryAction`: pulsante grande per l'azione del momento (varianti `brand` e `primary`), alto 56 px.
- `StatTile`: riquadro numero + etichetta + confronto (con la regola della Fase 0 dentro).
- `SectionHeader`: titolo maiuscolo piccolo + azione a destra (oggi è riscritto in ogni pagina).
- `EmptyState`: una riga di testo + un'azione, compatto.

**Tipografia:** quattro livelli fissi: titolo pagina (display 30), titolo card (display 20), numero grande (display 28–36),
testo (15/13). Etichette mai sotto 11 px.

**Verifica:** controllo automatico del contrasto sulle coppie di colori dei token; nessun `lime-`/`green-600`
residuo nei componenti (grep in CI).

### Fase 2 — Modalità allenamento (3–4 giorni)

Ispirata alla schermata di registrazione di Strava: durante la seduta c'è solo la seduta.

| Intervento | Dettaglio |
|---|---|
| Schermo intero | Su `/workout/active` la barra in basso non c'è (`(dashboard)/layout.tsx` la nasconde su quel percorso). Si esce solo dalla X in alto, con conferma se ci sono serie non salvate |
| Intestazione utile | Tempo trascorso grande, progresso "4/12 serie", e il **recupero** in corso ben visibile con +15 s / salta |
| Esercizio corrente aperto | L'esercizio a cui sei arrivato è espanso; gli altri compatti. "L'ultima volta: 80 kg × 8" visibile accanto a ogni serie (il dato c'è già) |
| Spuntare la serie | Area toccabile grande (almeno 48 px) per confermare la serie; vibrazione breve (`vibrationEnabled` c'è già nelle preferenze) |
| "Fine" al momento giusto | Pulsante secondario finché non c'è almeno una serie; diventa principale quando tutte le serie del giorno sono fatte |
| Il momento dopo | Riepilogo a schermo pieno: record personali festeggiati uno per uno ("Nuovo record: panca 85 kg × 6"), confronto con l'ultima volta dello stesso giorno del piano, avanzamento verso l'obiettivo della settimana, condivisione (esiste già) |

**Verifica:** prova nel browser dell'intera seduta (avvio → serie → recupero → fine → riepilogo) in formato iPhone;
nessuna uscita accidentale possibile senza conferma.

### Fase 3 — Obiettivi e motivazione (3 giorni)

| Intervento | Dettaglio |
|---|---|
| Obiettivo settimanale | Sedute a settimana (palestra) e/o km (corsa), scelto in base allo stile. Usa `Goal.weeklyFrequency` e `Profile.weeklyRunKmGoal` che esistono già. Si propone all'ingresso e nelle impostazioni |
| Anello in Home | Nella card "Questa settimana": anello di avanzamento (es. 2/4 sedute, 18/25 km) al posto dei soli numeri |
| Fitness che incoraggia | Periodo in corso = avanzamento verso l'obiettivo; il confronto col periodo prima resta, con la regola della Fase 0 |
| Record in alto | In Fitness i record recenti ("questo mese: 3 record") salgono sopra calendario e costanza |
| Serie di settimane | "6 settimane di fila con l'obiettivo raggiunto": più motivante dei giorni di fila per chi si allena 3–4 volte a settimana |

**Verifica:** test sul calcolo di obiettivo e serie di settimane (settimane ISO, fuso di Roma); screenshot di Home
e Fitness a inizio, metà e fine settimana.

### Fase 4 — Piani di corsa (2–3 settimane)

Il miglioramento più grande: per chi corre, l'app dice **cosa fare oggi**, come Runna.

**Cosa vede l'utente**
1. Sceglie un obiettivo: 5 km, 10 km, mezza maratona, maratona, oppure "correre con costanza".
2. Indica data della gara (facoltativa), giorni disponibili, km attuali a settimana e un tempo recente se lo ha.
3. Riceve un piano a settimane divise in fasi (**base → costruzione → picco → scarico**), con uscite di tipo diverso:
   facile, ripetute, ritmo, lungo, recupero. Ognuna con distanza (o durata) e **passo obiettivo**.
4. In Home: "Oggi: 6 × 800 m a 4'30"/km, recupero 2' di corsa lenta".
5. Dopo la corsa (dall'orologio o inserita a mano) l'app la abbina all'uscita prevista e mostra **fatto / parziale / saltato**,
   con il confronto tra passo previsto e reale.
6. Ogni settimana i passi si aggiornano in base alle corse fatte.

**Ibrido:** palestra e corsa nello stesso calendario settimanale, con la regola di non mettere gambe pesanti il giorno
prima di ripetute o lungo.

**Dati** (nuove tabelle, solo aggiunte):
- `RunPlan`: obiettivo, data gara, settimane, fase per settimana, stato.
- `RunWorkout`: giorno, tipo, distanza o durata, passo obiettivo, segmenti (riscaldamento, ripetute, recuperi, defaticamento) in JSON validato con Zod.
- `RunWorkout.runActivityId`: abbinamento con la corsa registrata.

**Generazione del piano**
- **Regole in codice** (gratis per tutti): progressione dei km a settimana di circa +10%, una settimana di scarico ogni 3–4,
  lungo al 25–30% dei km settimanali, maggior parte delle uscite facili, passi calcolati dal miglior tempo recente
  (`RunActivity.bestEfforts` esiste già).
- **Con il Coach** (funzione a pagamento): nuovo tool `propose_run_plan` per piani su misura e modifiche in chat
  ("questa settimana ho poco tempo"), con anteprima e "Applica" come per la palestra.

**Abbinamento corsa ↔ allenamento previsto:** stesso giorno (o ±1), tipo compatibile, distanza entro il 20%;
conferma manuale se ambiguo.

**Verifica:** test sulle regole di progressione (nessuna settimana oltre +10–15%, scarico presente, lungo nei limiti),
sull'abbinamento e sul calcolo dei passi; prova nel browser della creazione di un piano 10 km e di una settimana completa.

---

## 3. Ordine e tempi

| Fase | Durata | Dipende da |
|---|---|---|
| 0 — Correzioni rapide | 1 g | — |
| 1 — Regole di design | 2–3 gg | — |
| 2 — Modalità allenamento | 3–4 gg | 1 (usa `PrimaryAction`, token) |
| 3 — Obiettivi e motivazione | 3 gg | 0, 1 |
| 4 — Piani di corsa | 2–3 sett. | 1, 3 (anello e obiettivi) |

**Totale ≈ 4–5 settimane.** Ogni fase è una PR separata, verificata con screenshot prima/dopo.

## 4. Decisioni aperte (con raccomandazione)

| Decisione | Raccomandazione |
|---|---|
| Piani di corsa gratis o nel Coach | Piano base a regole **gratis** (porta utenti), personalizzazione e modifiche in chat **nel Coach** (motivo per pagare) |
| Obiettivo settimanale obbligatorio | No: proposto all'ingresso con un valore suggerito dallo storico, modificabile, saltabile |
| Social (kudos, feed amici) | Dopo: con pochi utenti un feed vuoto peggiora l'esperienza. Prima la motivazione personale (Fase 3) |
| Ordine | 0 → 1 → 2 → 3 → 4, come le dipendenze. La Fase 0 si può fare subito; la 1 è breve e rende più rapide le altre |
