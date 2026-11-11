import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stato vuoto compatto: una riga di testo e, se serve, un'azione */
export function EmptyState({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: { href: string; label: string } | { onClick: () => void; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-dashed border-border px-4 py-3",
        !action && "justify-center text-center",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{children}</p>
      {action &&
        ("href" in action ? (
          <Link href={action.href} className="flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-semibold">
            {action.label} <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-semibold">
            {action.label} <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ))}
    </div>
  );
}
