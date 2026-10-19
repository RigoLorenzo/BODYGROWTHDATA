"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

export function ProfileHeader({ user }: Props) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {/* Il profilo si apre dalle impostazioni: si torna lì */}
      <Link
        href="/profile/settings"
        aria-label="Torna alle impostazioni"
        className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-muted"
      >
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <div className="relative shrink-0">
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "Avatar"}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full border-2 border-border object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-full border-2 border-border bg-muted flex items-center justify-center font-display text-3xl font-bold uppercase">
            {user.name?.charAt(0) ?? "?"}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="truncate text-xl font-bold">{user.name ?? "Atleta"}</h1>
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}
