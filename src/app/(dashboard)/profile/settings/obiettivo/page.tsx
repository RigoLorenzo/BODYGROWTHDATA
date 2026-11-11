import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { weeklyGoalSummary } from "@/lib/weekly-goal-server";
import { WeeklyGoalForm } from "@/components/profile/weekly-goal-form";

export const metadata = { title: "Obiettivo settimanale" };

export default async function WeeklyGoalPage() {
  const session = await auth().catch(() => null);
  if (!session) redirect("/login");
  const summary = await weeklyGoalSummary(session.user.id);

  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 pb-6 pt-3">
      <div className="flex items-center gap-1">
        <Link
          href="/profile/settings"
          aria-label="Torna alle impostazioni"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Obiettivo settimanale</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        In Home vedi ogni settimana a che punto sei, e quante settimane di fila lo raggiungi.
      </p>
      <WeeklyGoalForm initial={summary} />
    </div>
  );
}
