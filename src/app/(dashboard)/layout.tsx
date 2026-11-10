import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ActiveSessionBanner } from "@/components/session/active-session-banner";
import { WorkoutConflictDialog } from "@/components/session/workout-conflict-dialog";
import { RunAutoSync } from "@/components/run/run-auto-sync";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth().catch(() => null);
  if (!session) redirect("/login");
  // Prima volta (o account di prima dello stile): si sceglie che allenamento fai.
  // Se il database non risponde si entra lo stesso.
  const user = await prisma.user
    .findUnique({ where: { id: session.user.id }, select: { trainingStyle: true } })
    .catch(() => undefined);
  if (user && !user.trainingStyle) redirect("/welcome");

  return (
    <div className="min-h-screen bg-background pt-safe pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-64">
      <ActiveSessionBanner />
      <main className="min-h-screen">{children}</main>
      <BottomNav />
      <WorkoutConflictDialog />
      <RunAutoSync />
    </div>
  );
}
