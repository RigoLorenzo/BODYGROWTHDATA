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

/** Valore con etichetta piccola sopra */
export function Stat({
  label,
  value,
  unit,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums leading-tight">
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}
      </p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

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

/** Legenda palestra/corsa usata da grafici e calendario */
export function ActivityLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4 text-xs text-muted-foreground", className)}>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-foreground/80" /> Palestra
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-lime-500" /> Corsa
      </span>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-3xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
