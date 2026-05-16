"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Github, Chrome, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2, "Nome minimo 2 caratteri"),
  email: z.string().email("Email non valida"),
  password: z.string().min(6, "Password minimo 6 caratteri"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Le password non coincidono",
  path: ["confirm"],
});

type FormData = z.infer<typeof schema>;

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.name, email: data.email, password: data.password }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Errore registrazione", description: err.error, variant: "destructive" });
      return;
    }

    await signIn("credentials", {
      email: data.email,
      password: data.password,
      callbackUrl: "/dashboard",
    });
  };

  const handleOAuth = async (provider: string) => {
    setIsOAuthLoading(provider);
    await signIn(provider, { callbackUrl: "/dashboard" });
    setIsOAuthLoading(null);
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Dumbbell className="h-8 w-8 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl">Crea Account</CardTitle>
        <CardDescription>Inizia il tuo percorso fitness oggi</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Input placeholder="Nome completo" {...register("name")} className="h-11" />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Input type="email" placeholder="Email" {...register("email")} className="h-11" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
          </div>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Password (min. 6 caratteri)"
              {...register("password")}
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Conferma password"
              {...register("confirm")}
              className="h-11"
            />
            {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm.message}</p>}
          </div>
          <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
            {isSubmitting ? "Registrazione..." : "Crea Account"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">oppure</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full h-10" onClick={() => handleOAuth("google")} disabled={!!isOAuthLoading}>
            <Chrome className="mr-2 h-4 w-4" />
            {isOAuthLoading === "google" ? "..." : "Google"}
          </Button>
          <Button variant="outline" className="w-full h-10" onClick={() => handleOAuth("github")} disabled={!!isOAuthLoading}>
            <Github className="mr-2 h-4 w-4" />
            {isOAuthLoading === "github" ? "..." : "GitHub"}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Hai già un account?{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">Accedi</Link>
        </p>
      </CardContent>
    </Card>
  );
}
