import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Settings } from "lucide-react";
import Link from "next/link";

interface Props {
  user: { name?: string | null };
}

export function DashboardHeader({ user }: Props) {
  const firstName = user.name?.split(" ")[0];

  return (
    <header className="flex items-start justify-between gap-3 pt-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {format(new Date(), "EEEE d MMMM", { locale: it })}
        </p>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-tight">
          {firstName ? `Ciao, ${firstName}` : "Ciao"}
        </h1>
      </div>
      <Link
        href="/profile/settings"
        aria-label="Impostazioni"
        className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
      >
        <Settings className="h-5 w-5" />
      </Link>
    </header>
  );
}
