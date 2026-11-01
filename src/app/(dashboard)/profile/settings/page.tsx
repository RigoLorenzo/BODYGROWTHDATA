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
    <div className="container mx-auto max-w-xl space-y-6 px-4 pb-6 pt-3">
      <div className="flex items-center gap-1">
        <Link
          href="/dashboard"
          aria-label="Torna alla home"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Impostazioni</h1>
      </div>

      <Link
        href="/profile"
        className="flex items-center gap-4 rounded-3xl bg-zinc-950 p-4 text-zinc-50 ring-1 ring-white/10 transition-transform active:scale-[0.99]"
        style={{ backgroundImage: "radial-gradient(120% 90% at 100% 0%, rgba(212,255,58,0.18), transparent 60%)" }}
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-display text-3xl font-extrabold uppercase ring-2 ring-[#d4ff3a] ring-offset-2 ring-offset-zinc-950">
          {name?.charAt(0) ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl font-bold uppercase leading-tight">{name ?? "Atleta"}</p>
          <p className="truncate text-xs text-zinc-400">Profilo, record, piani e misure corporee</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-[#d4ff3a]" />
      </Link>

      <SettingsForm user={session.user} />
    </div>
  );
}
