import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { readTrainingStyle } from "@/lib/training-style-server";
import { WelcomeStyle } from "@/components/profile/welcome-style";
import { invitePath, normalizeInviteCode } from "@/lib/coach/invite-code";

export const metadata = { title: "Benvenuto" };

/** Prima scelta dopo la registrazione: che tipo di allenamento fai */
interface Props {
  searchParams: Promise<{ invito?: string }>;
}

export default async function WelcomePage({ searchParams }: Props) {
  const session = await auth().catch(() => null);
  if (!session) redirect("/login");
  // Arrivato da un invito al Coach: dopo il benvenuto si torna lì
  const invite = normalizeInviteCode((await searchParams).invito);
  const next = invite ? invitePath(invite) : "/dashboard";
  // Già scelto: si va dritti alla home (lo si cambia dalle Impostazioni)
  if (await readTrainingStyle(session.user.id)) redirect(next);
  return <WelcomeStyle name={session.user.name?.split(" ")[0] ?? null} next={next} />;
}
