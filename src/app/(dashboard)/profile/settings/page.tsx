import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { SettingsForm } from "@/components/profile/settings-form";

export const metadata = { title: "Impostazioni" };

/** Aperte dall'ingranaggio della home: il profilo si raggiunge da qui */
export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const { name } = session.user;

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-6 pb-24">
      <div className="flex items-center gap-2 pt-2">
        <Link
          href="/dashboard"
          aria-label="Torna alla home"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Impostazioni</h1>
          <p className="text-sm text-muted-foreground">Personalizza la tua esperienza</p>
        </div>
      </div>

      <Link
        href="/profile"
        className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 transition-colors hover:border-border active:scale-[0.99]"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted font-display text-2xl font-bold uppercase">
          {name?.charAt(0) ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name ?? "Atleta"}</p>
          <p className="truncate text-xs text-muted-foreground">Profilo, record, piani e misure corporee</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <SettingsForm user={session.user} />
    </div>
  );
}
