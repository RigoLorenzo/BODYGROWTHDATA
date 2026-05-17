import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { ProfileHeader } from "@/components/profile/profile-header";
import { AchievementsGrid } from "@/components/profile/achievements-grid";
import { BodyMeasurements } from "@/components/profile/body-measurements";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Profilo" };

export default async function ProfilePage() {
  const session = await auth().catch(() => null);

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <ProfileHeader user={session?.user ?? {}} />

      <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
        <AchievementsGrid />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <BodyMeasurements />
      </Suspense>
    </div>
  );
}
