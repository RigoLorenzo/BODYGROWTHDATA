"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Download, Trash2, Moon, Sun, Dumbbell, RefreshCw, ChevronRight } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useUIStore } from "@/store/ui-store";

interface Props {
  user: { name?: string | null; email?: string | null };
}

export function SettingsForm({ user }: Props) {
  const { units, setUnits } = useUIStore();
  const [theme, setThemeState] = useState<"dark" | "light" | "oled">("dark");
  const [restDefault, setRestDefault] = useState(90);
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

      {/* Preferenze */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preferenze</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Unità di misura</p>
              <p className="text-xs text-muted-foreground">Pesi visualizzati in</p>
            </div>
            <Select value={units} onValueChange={(v) => setUnits(v as "kg" | "lbs")}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lbs">lbs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="text-xs text-muted-foreground">Aspetto dell&apos;app</p>
            </div>
            <Select value={theme} onValueChange={(v) => setThemeState(v as typeof theme)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">
                  <span className="flex items-center gap-1.5"><Moon className="h-3 w-3" /> Scuro</span>
                </SelectItem>
                <SelectItem value="light">
                  <span className="flex items-center gap-1.5"><Sun className="h-3 w-3" /> Chiaro</span>
                </SelectItem>
                <SelectItem value="oled">
                  <span className="flex items-center gap-1.5"><Dumbbell className="h-3 w-3" /> OLED</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Recupero default</p>
              <p className="text-xs text-muted-foreground">Secondi tra le serie</p>
            </div>
            <Select value={restDefault.toString()} onValueChange={(v) => setRestDefault(parseInt(v))}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[30, 60, 90, 120, 180, 240, 300].map((s) => (
                  <SelectItem key={s} value={s.toString()}>{s}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
