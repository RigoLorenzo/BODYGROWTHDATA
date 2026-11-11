import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { isCoachAdmin } from "@/lib/coach/access";
import { CoachAdmin } from "@/components/coach/coach-admin";

export const metadata = { title: "Coach · Gestione" };

/** Inviti, lista d'attesa, tester e costi: solo per chi gestisce il Coach */
export default async function CoachAdminPage() {
  const session = await auth().catch(() => null);
  if (!isCoachAdmin(session?.user?.id)) notFound();
  return <CoachAdmin />;
}
