"use client";

import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  user: { name?: string | null; image?: string | null };
}

export function DashboardHeader({ user }: Props) {
  return (
    <div className="flex items-center justify-between pt-2">
      <div>
        <p className="text-xs text-muted-foreground capitalize">
          {format(new Date(), "EEEE · d MMMM", { locale: it })}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">BodyGrowth</h1>
        {user.name && (
          <p className="text-sm text-muted-foreground">{user.name.split(" ")[0]}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/profile/settings">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
