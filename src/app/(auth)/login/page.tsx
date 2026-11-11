import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
import { invitePath, normalizeInviteCode } from "@/lib/coach/invite-code";

interface Props {
  searchParams: Promise<{ invito?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const invite = normalizeInviteCode((await searchParams).invito);
  const session = await auth();
  if (session) redirect(invite ? invitePath(invite) : "/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">BodyGrowth</h1>
          <p className="mt-2 text-muted-foreground">Elite Fitness Tracker</p>
        </div>
        <LoginForm invite={invite} />
      </div>
    </div>
  );
}
