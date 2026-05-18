import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { ProfileHeader } from "@/components/profile/profile-header";
import { BodyMeasurements } from "@/components/profile/body-measurements";
import { BodyStatsCard } from "@/components/profile/body-stats-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Profilo" };

export default async function ProfilePage() {
  const session = await auth().catch(() => null);

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <ProfileHeader user={session?.user ?? {}} />

      <Link href="/records">
        <Card className="border-border/50 hover:border-border transition-colors active:scale-[0.99]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-400/10">
              <Trophy className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Personal Records</p>
              <p className="text-xs text-muted-foreground">Visualizza i tuoi migliori risultati</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <Link href="/programs">
        <Card className="border-border/50 hover:border-border transition-colors active:scale-[0.99]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-400/10">
              <CalendarDays className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Piani di Allenamento</p>
              <p className="text-xs text-muted-foreground">Crea e segui un programma strutturato</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <BodyStatsCard />

      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <BodyMeasurements />
      </Suspense>
    </div>
  );
}
