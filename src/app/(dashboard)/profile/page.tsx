import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { BodyMeasurements } from "@/components/profile/body-measurements";
import { BodyStatsCard } from "@/components/profile/body-stats-card";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileLinks } from "@/components/profile/profile-links";

export const metadata = { title: "Profilo" };

export default async function ProfilePage() {
  const session = await auth().catch(() => null);

  return (
    <div className="container mx-auto max-w-xl space-y-5 px-4 pb-6 pt-3">
      <div className="flex items-center gap-1">
        {/* Il profilo si apre dalle impostazioni: si torna lì */}
        <Link
          href="/profile/settings"
          aria-label="Torna alle impostazioni"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Profilo</h1>
      </div>
      <ProfileHero user={session?.user ?? {}} />
      <ProfileLinks />
      <BodyStatsCard />
      <BodyMeasurements />
    </div>
  );
}
