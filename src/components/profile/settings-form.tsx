"use client";

import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  ChevronRight,
  Download,
  Dumbbell,
  Lightbulb,
  LogOut,
  Moon,
  RefreshCw,
  Smartphone,
  Sun,
  Trash2,
  UserRound,
  Watch,
  type LucideIcon,
} from "lucide-react";
import { DEVICES_PATH } from "@/components/devices/routes";
import { useDevices } from "@/components/run/queries";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { readTheme, saveTheme, type Theme } from "@/lib/theme";
import { readKeepAwake, saveKeepAwake } from "@/hooks/use-wake-lock";
import { Switch } from "@/components/ui/switch";
import { STYLE_INFO, type TrainingStyle } from "@/lib/training-style";

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: Smartphone },
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
];

interface Props {
  user: { name?: string | null; email?: string | null };
  /** stile di allenamento scelto (null: non ancora) */
  trainingStyle?: TrainingStyle | null;
}

/** "Garmin, Mi Fitness" · "Garmin: da ricollegare" · "Nessuno collegato" */
function useDevicesHint() {
  const { data } = useDevices();
  const connected = data?.devices.filter((d) => d.connection) ?? [];
  if (!data) return undefined;
  if (!connected.length) return "Nessuno collegato";
  const expired = connected.find((d) => d.connection?.lastError);
  return expired ? `${expired.label}: da ricollegare` : connected.map((d) => d.label).join(", ");
}

export function SettingsForm({ user, trainingStyle }: Props) {
  const devicesHint = useDevicesHint();
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
    <div className="space-y-6">
      <Group title="Allenamento">
        <Row
          href="/profile/settings/allenamento"
          icon={Activity}
          title="Stile di allenamento"
          hint={trainingStyle ? `${STYLE_INFO[trainingStyle].name} · ${STYLE_INFO[trainingStyle].goal}` : "Non ancora scelto"}
        />
      </Group>

      <Group title="Dispositivi">
        <Row href={DEVICES_PATH} icon={Watch} title="Smartwatch e app" hint={devicesHint} />
      </Group>

      <Group title="Aspetto">
        <div className="space-y-2 p-4">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Tema">
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
        </div>
      </Group>

      <Group title="Durante l'allenamento">
        <label className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3">
          <RowIcon icon={Lightbulb} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Schermo sempre acceso</span>
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
      </Group>

      <Group title="Esercizi">
        <Row
          href="/profile/exercises"
          icon={Dumbbell}
          title="Libreria esercizi"
        />
        <Row
          icon={RefreshCw}
          spinning={isSyncing}
          onClick={handleSyncExercises}
          disabled={isSyncing}
          title={isSyncing ? "Aggiornamento…" : "Aggiorna libreria"}
        />
      </Group>

      <Group title="Dati">
        <Row
          icon={Download}
          onClick={handleExportCSV}
          disabled={isExporting}
          title={isExporting ? "Esportazione…" : "Esporta in CSV"}
        />
      </Group>

      <Group title="Account">
        <div className="flex items-center gap-3 px-4 py-3">
          <RowIcon icon={UserRound} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{user.name ?? "—"}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </div>
        <Row icon={LogOut} onClick={() => signOut({ callbackUrl: "/login" })} title="Esci" />
      </Group>

      <Group title="Zona pericolosa" danger>
        <Row
          icon={Trash2}
          danger
          onClick={handleDeleteData}
          disabled={isDeleting}
          title={isDeleting ? "Eliminazione…" : "Elimina i dati di allenamento"}
          hint="L'account resta attivo"
        />
      </Group>
    </div>
  );
}

/** Gruppo di impostazioni: titolo piccolo sopra, righe in un'unica scheda */
function Group({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className={cn(
          "mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
          danger ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
        )}
      >
        {title}
      </h2>
      <div
        className={cn(
          "divide-y divide-border/60 overflow-hidden rounded-3xl border bg-card",
          danger ? "border-red-500/30" : "border-border/60"
        )}
      >
        {children}
      </div>
    </section>
  );
}

function RowIcon({ icon: Icon, danger, spinning }: { icon: LucideIcon; danger?: boolean; spinning?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        danger ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted text-foreground"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px]", spinning && "animate-spin motion-reduce:animate-none")} />
    </span>
  );
}

interface RowProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  spinning?: boolean;
}

/** Riga toccabile: link (con freccia) o azione */
function Row({ icon, title, hint, href, onClick, disabled, danger, spinning }: RowProps) {
  const content = (
    <>
      <RowIcon icon={icon} danger={danger} spinning={spinning} />
      <span className="min-w-0 flex-1 text-left">
        <span className={cn("block text-sm font-semibold", danger && "text-red-600 dark:text-red-400")}>{title}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      {href && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );
  const className = "flex min-h-16 w-full items-center gap-3 px-4 py-3 active:bg-muted/50 disabled:opacity-60";
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}
