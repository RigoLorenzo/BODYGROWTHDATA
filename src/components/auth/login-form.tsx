"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Chrome, Dumbbell } from "lucide-react";

export function LoginForm() {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSignIn = async (provider: string) => {
    setIsLoading(provider);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Dumbbell className="h-8 w-8 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl">Accedi a BodyGrowth</CardTitle>
        <CardDescription>
          Traccia i tuoi allenamenti, monitora i progressi e raggiungi i tuoi obiettivi
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          variant="outline"
          size="lg"
          onClick={() => handleSignIn("google")}
          disabled={!!isLoading}
        >
          <Chrome className="mr-2 h-5 w-5" />
          {isLoading === "google" ? "Connessione..." : "Continua con Google"}
        </Button>
        <Button
          className="w-full"
          variant="outline"
          size="lg"
          onClick={() => handleSignIn("github")}
          disabled={!!isLoading}
        >
          <Github className="mr-2 h-5 w-5" />
          {isLoading === "github" ? "Connessione..." : "Continua con GitHub"}
        </Button>
        <p className="text-center text-xs text-muted-foreground pt-2">
          Continuando, accetti i nostri Termini di Servizio e la Privacy Policy
        </p>
      </CardContent>
    </Card>
  );
}
