import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";

/** Blocco della pagina con titolo nello stile del cruscotto */
export function Section({
  title,
  hint,
  action,
  className,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-3xl border border-border/60 bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Valore con etichetta piccola sopra (alias storico di StatTile) */
export { StatTile as Stat } from "@/components/ui/stat-tile";

/** Selettore a pillole (periodo, metrica) */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex rounded-xl bg-muted p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-lg px-2 font-medium transition-colors",
            size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
            value === o.value ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Legenda palestra/corsa (e bici e altro, se ci sono) usata da grafici e calendario */
export function ActivityLegend({ className, other = false }: { className?: string; other?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground" /> Palestra
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-run" /> Corsa
      </span>
      {other && (
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Bici e altro
        </span>
      )}
    </div>
  );
}

export { EmptyState } from "@/components/ui/empty-state";

/**
 * Blocco della pagina senza riquadro: una linea sottile sopra, un'etichetta
 * discreta e tanto spazio. I numeri restano i protagonisti.
 */
export function Block({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("border-t border-border/60 pt-6", className)}>
      {(title || action) && <SectionHeader title={title} action={action} className="mb-4" />}
      {children}
    </section>
  );
}
