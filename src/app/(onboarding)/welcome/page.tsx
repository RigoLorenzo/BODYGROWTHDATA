import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { readTrainingStyle } from "@/lib/training-style-server";
import { WelcomeStyle } from "@/components/profile/welcome-style";

export const metadata = { title: "Benvenuto" };

/** Prima scelta dopo la registrazione: che tipo di allenamento fai */
export default async function WelcomePage() {
  const session = await auth().catch(() => null);
  if (!session) redirect("/login");
  // Già scelto: si va dritti alla home (lo si cambia dalle Impostazioni)
  if (await readTrainingStyle(session.user.id)) redirect("/dashboard");
  return <WelcomeStyle name={session.user.name?.split(" ")[0] ?? null} />;
}
