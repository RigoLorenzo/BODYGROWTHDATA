import { cn } from "@/lib/utils";

export interface BarDatum {
  key: string;
  label: string;
  /** palestra (o valore unico) */
  primary: number;
  /** corsa, impilata sopra */
  secondary?: number;
  /** testo sopra la barra */
  caption?: string;
  highlight?: boolean;
}

/**
 * Barre verticali impilate palestra + corsa, in HTML: leggere e nitide su
 * qualsiasi schermo, senza librerie di grafici.
 */
const columnClass = "flex h-full min-w-0 flex-1 flex-col items-center justify-end";

/** Colonna del grafico: pulsante quando le barre si possono scegliere */
function Column({
  onClick,
  pressed,
  title,
  children,
}: {
  onClick?: () => void;
  pressed?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (!onClick) {
    return (
      <div className={columnClass} title={title}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={title}
      className={cn(columnClass, "rounded-md transition-transform active:scale-95")}
    >
      {children}
    </button>
  );
}

export function StackedBars({
  data,
  height = 128,
  labelEvery = 1,
  className,
  onSelect,
}: {
  data: BarDatum[];
  height?: number;
  labelEvery?: number;
  className?: string;
  /** Barre toccabili: riceve la chiave della barra scelta */
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(1, ...data.map((d) => d.primary + (d.secondary ?? 0)));
  const last = data.length - 1;
  return (
    <div className={className}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d) => {
          const total = d.primary + (d.secondary ?? 0);
          return (
            <Column
              key={d.key}
              onClick={onSelect ? () => onSelect(d.key) : undefined}
              pressed={onSelect ? !!d.highlight : undefined}
              title={`${d.label}: ${d.caption ?? total}`}
            >
              {d.caption && total > 0 && (
                <span className={cn("mb-1 text-[10px] tabular-nums", d.highlight ? "font-bold text-foreground" : "text-muted-foreground")}>
                  {d.caption}
                </span>
              )}
              <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-md" style={{ height: `${(total / max) * 100}%` }}>
                {!!d.secondary && <div className="w-full bg-lime-500" style={{ flexGrow: d.secondary }} />}
                {!!d.primary && <div className={cn("w-full", d.highlight ? "bg-foreground" : "bg-foreground/60")} style={{ flexGrow: d.primary }} />}
              </div>
              {total === 0 && <div className="h-1 w-full rounded-full bg-muted" />}
            </Column>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={d.key} className="min-w-0 flex-1 whitespace-nowrap text-center">
            {(last - i) % labelEvery === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barre orizzontali per classifiche e distribuzioni */
export function HorizontalBars({
  rows,
}: {
  rows: { key: string; label: string; value: number; caption: string; highlight?: boolean }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 text-sm">
          <span className={cn("w-24 shrink-0 truncate", r.highlight && "font-semibold")}>{r.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full", r.highlight ? "bg-foreground" : "bg-foreground/40")}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className={cn("w-20 shrink-0 text-right text-xs tabular-nums", r.highlight ? "font-semibold" : "text-muted-foreground")}>
            {r.caption}
          </span>
        </li>
      ))}
    </ul>
  );
}
