import { cn } from "@/lib/utils";

/** Titolo di sezione: maiuscolo piccolo e discreto, con un'azione facoltativa a destra */
export function SectionHeader({
  title,
  action,
  as: Tag = "h2",
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  as?: "h2" | "h3" | "p";
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-center justify-between gap-3", className)}>
      <Tag className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</Tag>
      {action}
    </div>
  );
}
