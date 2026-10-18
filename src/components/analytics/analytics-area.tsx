"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Dumbbell, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { WellnessTabs } from "@/components/wellness/wellness-tabs";
import { AnalyticsTabs } from "./analytics-tabs";

const AREAS = [
  { value: "allenamenti", label: "Allenamenti", hint: "Palestra e corsa, i tuoi numeri", icon: Dumbbell },
  { value: "benessere", label: "Benessere", hint: "Battiti, sonno e recupero dallo smartwatch", icon: HeartPulse },
] as const;
type Area = (typeof AREAS)[number]["value"];

/**
 * Analytics in due aree scelte dal titolo a tendina (?area=): allenamenti e
 * benessere. Cambiando area si riparte dalla prima scheda.
 */
export function AnalyticsArea() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const area: Area = params.get("area") === "benessere" ? "benessere" : "allenamenti";
  const current = AREAS.find((a) => a.value === area)!;

  const select = (value: Area) => {
    if (value === area) return;
    router.replace(value === "allenamenti" ? pathname : `${pathname}?area=${value}`, { scroll: false });
  };

  return (
    <div className="space-y-3">
      <div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="-ml-1 flex items-center gap-1.5 rounded-xl px-1 font-display text-3xl font-bold uppercase tracking-wide active:bg-muted/60"
              aria-label={`Area: ${current.label}. Cambia area`}
            >
              {current.label}
              <ChevronDown className="h-6 w-6 text-muted-foreground" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="z-50 min-w-[260px] rounded-2xl border border-border/60 bg-popover p-1.5 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0"
            >
              {AREAS.map((a) => (
                <DropdownMenu.Item
                  key={a.value}
                  onSelect={() => select(a.value)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 outline-none data-[highlighted]:bg-muted",
                    a.value === area && "bg-muted/60"
                  )}
                >
                  <a.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{a.label}</span>
                    <span className="block text-xs text-muted-foreground">{a.hint}</span>
                  </span>
                  {a.value === area && <Check className="h-4 w-4 shrink-0" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <p className="text-sm text-muted-foreground">{current.hint}</p>
      </div>
      {area === "benessere" ? <WellnessTabs /> : <AnalyticsTabs />}
    </div>
  );
}
