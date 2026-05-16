import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/profile/settings-form";

export const metadata = { title: "Impostazioni" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="container max-w-2xl mx-auto p-4 space-y-6 pb-24">
      <div className="flex items-center gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold">Impostazioni</h1>
          <p className="text-sm text-muted-foreground">Personalizza la tua esperienza</p>
        </div>
      </div>
      <SettingsForm user={session.user} />
    </div>
  );
}
