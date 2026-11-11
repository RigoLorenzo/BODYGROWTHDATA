import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { weeklyGoalSummary } from "@/lib/weekly-goal-server";
import { invitePath, normalizeInviteCode } from "@/lib/coach/invite-code";
import { WeeklyGoalForm } from "@/components/profile/weekly-goal-form";

export const metadata = { title: "Il tuo obiettivo" };

interface Props {
  searchParams: Promise<{ invito?: string }>;
}

/** Benvenuto, secondo passo: un obiettivo settimanale già proposto, da confermare o saltare */
export default async function WelcomeGoalPage({ searchParams }: Props) {
  const session = await auth().catch(() => null);
  if (!session) redirect("/login");
  const invite = normalizeInviteCode((await searchParams).invito);
  const next = invite ? invitePath(invite) : "/dashboard";
  const summary = await weeklyGoalSummary(session.user.id);

  return (
    <div className="container mx-auto max-w-xl px-4 pb-10 pt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ultimo passo</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-none">Il tuo obiettivo</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Quante volte vuoi allenarti a settimana? In Home vedrai a che punto sei e quante settimane di fila lo raggiungi. Puoi
        cambiarlo quando vuoi dalle Impostazioni.
      </p>
      <div className="mt-6">
        <WeeklyGoalForm initial={summary} next={next} propose />
      </div>
      <Link
        href={next}
        className="mt-2 flex min-h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-muted-foreground active:bg-muted"
      >
        Salta per ora
      </Link>
    </div>
  );
}
