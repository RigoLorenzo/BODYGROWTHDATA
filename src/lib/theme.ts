export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "bodygrowth-theme";
export const THEMES: Theme[] = ["system", "light", "dark"];

const THEME_COLORS = { light: "#ffffff", dark: "#000000" } as const;

export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(value as Theme) ? (value as Theme) : "system";
  } catch {
    return "system";
  }
}

export const resolveTheme = (theme: Theme): "light" | "dark" =>
  theme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : theme;

/** Applica il tema alla pagina: classe .dark e colore della barra di sistema */
export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  // Next genera un meta per schema (chiaro/scuro): la scelta esplicita vale per entrambi
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLORS[resolved]));
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage non disponibile (es. navigazione privata): vale solo per questa visita
  }
  applyTheme(theme);
}

/**
 * Script eseguito prima del primo disegno della pagina, così non c'è il lampo
 * di tema sbagliato al caricamento. Deve restare autonomo (niente import).
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||((t===null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;if(d)e.classList.add("dark");e.style.colorScheme=d?"dark":"light";document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",d?"${THEME_COLORS.dark}":"${THEME_COLORS.light}")});}catch(_){}})();`;
