import Link from "next/link";
import { Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { coachLevel } from "@/lib/coach/access";
import { inviteStatus } from "@/lib/coach/invites";
import { RedeemInvite } from "@/components/coach/redeem-invite";

export const metadata = { title: "Invito al Coach" };

interface Props {
  params: Promise<{ code: string }>;
}

const button = "flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold active:scale-[0.98]";

/**
 * Link d'invito al Coach: pagina pubblica. Chi non ha un account si registra
 * (il codice resta nell'indirizzo fino al ritorno qui), poi attiva con un tocco.
 */
export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const [invite, session] = await Promise.all([inviteStatus(code), auth().catch(() => null)]);
  const level = session?.user?.id ? await coachLevel(session.user.id) : "none";

  return (
    <div className="oled-black flex min-h-screen items-center justify-center p-4 pt-safe pb-safe">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border/50 bg-card p-6 text-card-foreground">
        <Sparkles className="h-8 w-8 text-primary" aria-hidden />
        {level !== "none" ? (
          <>
            <h1 className="text-2xl font-semibold">Hai già il Coach</h1>
            <Link href="/coach" className={`${button} bg-foreground text-background`}>
              Apri il Coach
            </Link>
          </>
        ) : !invite ? (
          <>
            <h1 className="text-2xl font-semibold">Invito non valido</h1>
            <p className="text-sm text-muted-foreground">
              Il codice è scaduto, è già stato usato o non esiste. Chiedi un nuovo invito, oppure mettiti in lista d&apos;attesa
              dalla sezione Coach.
            </p>
            <Link href={session ? "/coach" : "/login"} className={`${button} border border-border`}>
              {session ? "Vai al Coach" : "Accedi a BodyGrowth"}
            </Link>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invito · {invite.label}</p>
              <h1 className="text-2xl font-semibold leading-tight">Sei stato invitato a provare il Coach di BodyGrowth</h1>
              <p className="text-sm text-muted-foreground">
                Il tuo personal trainer: legge i tuoi allenamenti, risponde con i tuoi numeri veri e ti prepara il piano. Gratis
                per i tester.
              </p>
            </div>
            {session ? (
              <RedeemInvite code={invite.code} />
            ) : (
              <div className="space-y-2">
                <Link href={`/register?invito=${invite.code}`} className={`${button} bg-foreground text-background`}>
                  Crea un account
                </Link>
                <Link href={`/login?invito=${invite.code}`} className={`${button} border border-border`}>
                  Ho già un account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
