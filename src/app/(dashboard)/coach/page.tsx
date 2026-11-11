import { auth } from "@/lib/auth";
import { coachLevel, isCoachAdmin, isCoachConfigured } from "@/lib/coach/access";
import { waitlistEntry } from "@/lib/coach/invites";
import { CoachChat } from "@/components/coach/coach-chat";
import { CoachWaitlist } from "@/components/coach/coach-waitlist";

export const metadata = { title: "Coach" };

interface Props {
  searchParams: Promise<{ t?: string }>;
}

function Unavailable({ title, text }: { title: string; text: string }) {
  return (
    <div className="container mx-auto max-w-xl space-y-6 px-4 pb-6 pt-3">
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Coach</h1>
      <div className="rounded-3xl bg-muted/60 p-6 text-center">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export default async function CoachPage({ searchParams }: Props) {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  const level = await coachLevel(userId);
  const admin = isCoachAdmin(userId);

  // Senza accesso: presentazione del Coach, lista d'attesa e codice d'invito
  if (level === "none") {
    const entry = userId ? await waitlistEntry(userId) : null;
    return <CoachWaitlist waitlisted={Boolean(entry)} />;
  }
  if (!isCoachConfigured()) {
    return admin ? (
      <Unavailable title="Coach non configurato" text="Manca la chiave ANTHROPIC_API_KEY nelle variabili d'ambiente del server." />
    ) : (
      <Unavailable title="Coach momentaneamente non disponibile" text="Riprova più tardi." />
    );
  }
  const { t } = await searchParams;
  return <CoachChat initialThreadId={t ?? null} isAdmin={admin} />;
}
