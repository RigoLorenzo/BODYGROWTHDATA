"use client";

import { Button } from "@/components/ui/button";
import { Settings, Edit } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Props {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

export function ProfileHeader({ user }: Props) {
  return (
    <div className="flex items-start gap-4 pt-2">
      <div className="relative">
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "Avatar"}
            width={72}
            height={72}
            className="rounded-full border-2 border-border"
          />
        ) : (
          <div className="h-18 w-18 rounded-full border-2 border-border bg-muted flex items-center justify-center text-2xl font-bold">
            {user.name?.charAt(0) ?? "?"}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold">{user.name ?? "Atleta"}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <Button variant="ghost" size="icon" asChild>
        <Link href="/profile/settings">
          <Settings className="h-5 w-5" />
        </Link>
      </Button>
    </div>
  );
}
