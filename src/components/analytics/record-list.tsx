import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export interface RecordItem {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  href?: string;
}

/** Righe piatte: cosa, quando, e il valore a destra. Quelle con un'attività la aprono */
export function RecordList({ items }: { items: RecordItem[] }) {
  return (
    <ul className="-my-2 divide-y divide-border/50">
      {items.map((item) => {
        const body = (
          <>
            <item.icon className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
            </span>
            <span className="shrink-0 font-display text-xl font-bold tabular-nums first-letter:uppercase">{item.value}</span>
            <ChevronRight className={item.href ? "h-4 w-4 shrink-0 text-muted-foreground" : "invisible h-4 w-4 shrink-0"} aria-hidden />
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 active:bg-muted/50">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
