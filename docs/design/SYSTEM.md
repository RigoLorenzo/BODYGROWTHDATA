# BodyGrowth — Regole di design

> Il sistema minimo che rende coerente ogni schermata. Nato dalla Fase 1 di `docs/design/PLAN.md`.
> Il codice è la fonte: colori in `src/app/globals.css` e `tailwind.config.ts`, componenti in `src/components/ui/`.
> `src/lib/__tests__/design-tokens.test.ts` controlla contrasto e classi vietate a ogni `npm test`.

## Colori con un significato

| Token (Tailwind) | Significato | Esempi |
|---|---|---|
| `brand` / `brand-foreground` | **Allenati adesso** e **progresso verso un obiettivo** | Anello dell'obiettivo, barra delle serie fatte, oggi nel calendario, banner "allenamento in corso" |
| `brand-strong` | Testo lime su pagina e card (lime-700 in chiaro, contrasto ≥ 4,5:1) | Etichetta "Piano attivo", "Prossimo" |
| `brand-bright` | Lime acceso sulle **superfici sempre scure** (card di Oggi, riepilogo di fine seduta, profilo) | Pulsante "Inizia", codice del giorno, nuovi record |
| `primary` | Tutte le altre azioni principali | Salva, Continua, Crea esercizio |
| `success` / `success-foreground` | **Completato, record, obiettivo raggiunto, andamento positivo** | Serie spuntata, esercizio finito, freccia verde nei confronti, "Fresco" |
| `success-inverse` | Positivo sulle superfici invertite (`bg-foreground`) | Confronti nelle card nere/bianche |
| `run` / `run-strong` | Categoria **corsa** in grafici, calendario e legende | Barre e giorni di corsa, traccia sulla mappa |
| `destructive`, ambra | Eliminazioni / avvisi | Già così |

Regole:
- Il lime **non** si usa per decorare: se non è un'azione "adesso" o un progresso, è `primary` o neutro.
- Testo verde su fondo chiaro: sempre `brand-strong` o `success` (mai `lime-400/500` come testo).
- La corsa oggi ha lo stesso colore del brand (`--run: var(--brand)`): per darle un colore suo basta cambiare `--run` in `globals.css`.
- Vietati nei componenti `lime-*`, `green-*`, `emerald-*` e `#d4ff3a` scritti a mano (il test fallisce).
- I colori delle categorie muscolari (`muscle.*`) restano a parte: sono dati, non significati.

## Componenti condivisi (`src/components/ui/`)

| Componente | Quando | Note |
|---|---|---|
| `PrimaryAction`, `PrimaryActionLink`, `primaryActionClass()` | L'azione del momento, una per schermata | Alta 56 px, a tutta larghezza. `variant="brand"` solo per "allenati adesso" sulle superfici scure, altrimenti `primary` |
| `StatTile` | Numero + etichetta (+ unità, + confronto) | Il confronto passa da `diffTone` (lib/compare): niente frecce senza dati, grigio a inizio periodo. `Stat` di analytics è lo stesso componente |
| `SectionHeader` | Titolo di sezione maiuscolo piccolo con azione a destra | Usato da `Block` |
| `EmptyState` | Stato vuoto | Una riga + al massimo un'azione (link o pulsante); niente riquadri alti |
| `ProgressRing` | Avanzamento verso un obiettivo | `stroke-brand`, spunta a obiettivo raggiunto |

## Tipografia

| Livello | Classe | Uso |
|---|---|---|
| Titolo pagina | `font-display text-3xl font-bold uppercase` (30 px) | Un `h1` per pagina |
| Titolo card | `font-display text-xl font-bold uppercase` (20 px) | `Section`, card della Home |
| Numero grande | `font-display text-2xl`–`text-[36px]` `tabular-nums` | `StatTile` (`md` 24 px, `lg` 32 px) |
| Testo | `text-[15px]` / `text-sm` (14) / `text-xs` (12–13) | Corpo e note |
| Etichetta | `text-[11px] uppercase tracking-wider` | **Mai sotto 11 px** (il test lo controlla) |

## Superfici

- **Card**: `rounded-3xl border border-border/60 bg-card p-5`.
- **Lastra scura** (Oggi, riepilogo, profilo): `bg-zinc-950 text-zinc-50`, uguale nei due temi; sopra si usa `brand-bright`.
- **Invertita** (`bg-foreground text-background`): punteggi del Benessere; i positivi in `success-inverse`.

## Tocco

- Aree toccabili almeno 44 px (`min-h-11`), le azioni principali 56 px.
- Feedback alla pressione: `active:scale-[0.98]` o `active:bg-muted`.
