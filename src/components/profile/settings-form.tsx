"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Download, Trash2, Moon, Sun, Dumbbell, RefreshCw, ChevronRight, Smartphone } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { readTheme, saveTheme, type Theme } from "@/lib/theme";
import { readKeepAwake, saveKeepAwake } from "@/hooks/use-wake-lock";
import { Switch } from "@/components/ui/switch";

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: Smartphone },
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
];

interface Props {
  user: { name?: string | null; email?: string | null };
}

export function SettingsForm({ user }: Props) {
  const [theme, setTheme] = useState<Theme>("system");
  const [keepAwake, setKeepAwake] = useState(true);
  useEffect(() => {
    setTheme(readTheme());
    setKeepAwake(readKeepAwake());
  }, []);

  const changeTheme = (value: Theme) => {
    setTheme(value);
    saveTheme(value);
  };
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Ricarica la libreria esercizi di sistema (nomi inglese + italiano)
  const handleSyncExercises = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error();
      toast({ title: "Libreria aggiornata", description: data.message });
    } catch {
      toast({ title: "Errore aggiornamento libreria", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/export/csv");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bodygrowth-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export completato", description: "Il file CSV è stato scaricato" });
    } catch {
      toast({ title: "Errore export", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteData = async () => {
    if (!confirm("Sei sicuro? Questa azione eliminerà TUTTI i tuoi dati di allenamento. Non è reversibile.")) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/user/data", { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Dati eliminati" });
    } catch {
      toast({ title: "Errore eliminazione", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Account */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Separator />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Disconnetti
          </Button>
        </CardContent>
      </Card>

      {/* Aspetto */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Tema">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => changeTheme(value)}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors",
                  theme === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            &ldquo;Sistema&rdquo; segue il tema del telefono. La scelta vale per questo dispositivo.
          </p>
        </CardContent>
      </Card>

      {/* Allenamento */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Allenamento</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Schermo sempre acceso</span>
              <span className="block text-xs text-muted-foreground">
                Il telefono non si blocca tra una serie e l&apos;altra mentre sei nella schermata dell&apos;allenamento.
              </span>
            </span>
            <Switch
              checked={keepAwake}
              onCheckedChange={(value) => {
                setKeepAwake(value);
                saveKeepAwake(value);
              }}
              aria-label="Schermo sempre acceso durante l'allenamento"
            />
          </label>
        </CardContent>
      </Card>

      {/* Esercizi */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Esercizi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-between" asChild>
            <Link href="/profile/exercises">
              <span className="flex items-center">
                <Dumbbell className="h-4 w-4 mr-2" />
                Gestisci libreria esercizi
              </span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Consulta il catalogo, cerca in italiano o inglese e aggiungi i tuoi esercizi personalizzati.
          </p>

          <Separator />

          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleSyncExercises}
            disabled={isSyncing}
          >
            <RefreshCw className={isSyncing ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"} />
            {isSyncing ? "Aggiornamento..." : "Aggiorna libreria esercizi"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Ricarica il catalogo completo con i nomi in inglese e in italiano. Serve solo se
            qualcosa non risulta aggiornato: i tuoi esercizi personalizzati non vengono toccati.
          </p>
        </CardContent>
      </Card>

      {/* Dati */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">I Tuoi Dati</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleExportCSV}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Esportazione..." : "Esporta tutto in CSV"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Scarica tutti i tuoi allenamenti, serie e misurazioni in formato CSV.
          </p>

        </CardContent>
      </Card>

      {/* Zona pericolosa */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive">Zona Pericolosa</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={handleDeleteData}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? "Eliminazione..." : "Elimina tutti i dati di allenamento"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Elimina definitivamente tutti gli allenamenti, serie, misurazioni e record. L&apos;account rimane attivo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
