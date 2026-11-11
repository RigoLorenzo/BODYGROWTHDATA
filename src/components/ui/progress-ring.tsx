import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Anello di avanzamento verso un obiettivo. Il verde lime è il colore del
 * progresso; a obiettivo raggiunto l'anello si chiude e compare la spunta.
 */
export function ProgressRing({
  ratio,
  size = 48,
  stroke = 5,
  label,
  className,
}: {
  ratio: number;
  size?: number;
  stroke?: number;
  /** testo per gli screen reader, es. "2 di 4 sedute" */
  label: string;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, ratio));
  const done = clamped >= 1;
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="stroke-lime-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {done && <Check className="absolute h-1/2 w-1/2 text-lime-600 dark:text-lime-400" aria-hidden />}
    </span>
  );
}
