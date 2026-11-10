import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { readTrainingStyle } from "@/lib/training-style-server";
import { TrainingStyleSettings } from "@/components/profile/training-style-settings";

export const metadata = { title: "Stile di allenamento" };

export default async function TrainingStylePage() {
  const session = await auth().catch(() => null);
  if (!session) redirect("/login");
  const style = await readTrainingStyle(session.user.id);

  return (
    <div className="container mx-auto max-w-xl space-y-4 px-4 pb-6 pt-3">
      <div className="flex items-center gap-1">
        <Link
          href="/profile/settings"
          aria-label="Torna alle impostazioni"
          className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Stile di allenamento</h1>
      </div>
      <TrainingStyleSettings initial={style} />
    </div>
  );
}
