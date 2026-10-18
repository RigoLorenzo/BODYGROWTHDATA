"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

/** Scheda scelta nell'URL (?tab=): la prima è quella predefinita e non compare */
export function useUrlTab<T extends string>(tabs: readonly TabOption<T>[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get("tab");
  const tab = tabs.find((t) => t.value === requested)?.value ?? tabs[0].value;

  const select = (value: T) => {
    const next = new URLSearchParams(params);
    if (value === tabs[0].value) next.delete("tab");
    else next.set("tab", value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return [tab, select] as const;
}

/** Pillole scorrevoli fissate in alto */
export function TabStrip<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const active = useRef<HTMLButtonElement>(null);

  // La scheda scelta resta visibile nella barra scorrevole
  useEffect(() => {
    active.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [value]);

  return (
    <div className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div role="tablist" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.value}
            ref={t.value === value ? active : undefined}
            role="tab"
            aria-selected={t.value === value}
            onClick={() => onChange(t.value)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
              t.value === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground active:bg-muted/70"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
