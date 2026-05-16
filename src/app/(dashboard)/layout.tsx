import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ActiveSessionBanner } from "@/components/session/active-session-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth().catch(() => null);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <ActiveSessionBanner />
      <main className="min-h-screen">{children}</main>
      <BottomNav />
    </div>
  );
}
