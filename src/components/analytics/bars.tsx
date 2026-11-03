import { cn } from "@/lib/utils";

export interface BarDatum {
  key: string;
  label: string;
  /** palestra (o valore unico) */
  primary: number;
  /** corsa, impilata sopra */
  secondary?: number;
  /** bici e altre attività, in cima */
  tertiary?: number;
  /** testo sopra la barra */
  caption?: string;
  /** il periodo in corso: etichetta in evidenza */
  highlight?: boolean;
  /** periodo non ancora arrivato: nessuna barra */
  future?: boolean;
}

/** Spazio sopra le barre per il valore della più alta */
const CAPTION_PX = 18;

const columnClass = "flex h-full min-w-0 flex-1 flex-col items-center justify-end";

/** Colonna del grafico: pulsante quando le barre si possono scegliere */
function Column({ onClick, title, children }: { onClick?: () => void; title: string; children: React.ReactNode }) {
  if (!onClick) {
    return (
      <div className={columnClass} title={title}>
        {children}
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={title} className={cn(columnClass, "rounded-lg transition-transform active:scale-95")}>
      {children}
    </button>
  );
}

const total = (d: BarDatum) => d.primary + (d.secondary ?? 0) + (d.tertiary ?? 0);

/**
 * Barre verticali impilate (palestra, corsa, altro) in HTML: nitide su ogni
 * schermo, con il valore sopra ogni barra e, se c'è, la linea della media
 * per capire subito cosa è sopra o sotto il solito.
 */
export function StackedBars({
  data,
  height = 140,
  labelEvery = 1,
  className,
  onSelect,
  average,
}: {
  data: BarDatum[];
  height?: number;
  labelEvery?: number;
  className?: string;
  /** Barre toccabili: riceve la chiave della barra scelta */
  onSelect?: (key: string) => void;
  /** linea tratteggiata della media, con la sua etichetta */
  average?: { value: number; label: string } | null;
}) {
  const max = Math.max(1, ...data.map(total), average?.value ?? 0);
  const px = (v: number) => (v / max) * height;
  const last = data.length - 1;

  return (
    <div className={className}>
      <div className="relative" style={{ height: height + CAPTION_PX, paddingTop: CAPTION_PX }}>
        {/* Linea di base */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border" aria-hidden />

        {average && average.value > 0 && (
          <div className="pointer-events-none absolute inset-x-0 z-0" style={{ bottom: px(average.value) }} aria-hidden>
            <div className="border-t border-dashed border-foreground/50" />
          </div>
        )}

        {/* Barre e valori sopra la linea della media: la linea passa dietro */}
        <div className="relative z-10 flex h-full items-end gap-1.5">
          {data.map((d) => {
            const sum = total(d);
            return (
              <Column key={d.key} onClick={onSelect && !d.future ? () => onSelect(d.key) : undefined} title={`${d.label}: ${d.caption ?? sum}`}>
                {d.caption && sum > 0 && (
                  <span className={cn("mb-0.5 whitespace-nowrap rounded bg-background px-0.5 text-[10px] tabular-nums", d.highlight ? "font-bold text-foreground" : "text-muted-foreground")}>
                    {d.caption}
                  </span>
                )}
                {sum > 0 ? (
                  <div className="flex w-full max-w-[28px] flex-col gap-[2px]" style={{ height: Math.max(4, px(sum)) }}>
                    {!!d.tertiary && <div className="w-full rounded-[4px] bg-sky-500" style={{ flexGrow: d.tertiary }} />}
                    {!!d.secondary && <div className="w-full rounded-[4px] bg-lime-500" style={{ flexGrow: d.secondary }} />}
                    {!!d.primary && <div className="w-full rounded-[4px] bg-foreground" style={{ flexGrow: d.primary }} />}
                  </div>
                ) : (
                  !d.future && <div className="mb-px h-1 w-full max-w-[28px] rounded-full bg-muted" />
                )}
              </Column>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px]">
        {data.map((d, i) => (
          <span
            key={d.key}
            className={cn(
              "min-w-0 flex-1 whitespace-nowrap text-center capitalize",
              d.highlight ? "font-bold text-foreground" : d.future ? "text-muted-foreground/50" : "text-muted-foreground"
            )}
          >
            {d.highlight || (last - i) % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      {/* La media in legenda: sopra la linea vuol dire meglio del solito */}
      {average && average.value > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="w-4 border-t border-dashed border-foreground/60" aria-hidden />
          <span className="font-medium text-foreground">{average.label}</span>
        </p>
      )}
    </div>
  );
}
