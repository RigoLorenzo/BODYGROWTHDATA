"use client";

import { useEffect } from "react";
import { applyTheme, readTheme } from "@/lib/theme";

/** Con il tema "Sistema" segue il telefono anche mentre l'app è aperta */
export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readTheme() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return null;
}
