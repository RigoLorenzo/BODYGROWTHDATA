import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Pagine d'ingresso: solo per chi è collegato, senza la barra in basso */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth().catch(() => null);
  if (!session) redirect("/login");
  return <div className="min-h-screen bg-background pt-safe">{children}</div>;
}
