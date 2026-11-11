import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { invitePath, normalizeInviteCode } from "@/lib/coach/invite-code";

export const metadata = { title: "Registrati" };

interface Props {
  searchParams: Promise<{ invito?: string }>;
}

export default async function RegisterPage({ searchParams }: Props) {
  const invite = normalizeInviteCode((await searchParams).invito);
  const session = await auth();
  if (session) redirect(invite ? invitePath(invite) : "/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">BodyGrowth</h1>
          <p className="mt-2 text-muted-foreground">Crea il tuo account</p>
        </div>
        <RegisterForm invite={invite} />
      </div>
    </div>
  );
}
