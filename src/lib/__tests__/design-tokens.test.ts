import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Contrasto delle coppie di colori del sistema (docs/design/SYSTEM.md),
 * letto da globals.css: testo >= 4,5:1 (WCAG AA) in chiaro e in scuro.
 */

type Theme = Record<string, string>;

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function block(selector: string): Theme {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  const vars: Theme = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const light = block(":root");
const dark = { ...light, ...block(".dark") };

function resolve(theme: Theme, name: string): string {
  const value = theme[name];
  if (value == null) throw new Error(`--${name} mancante`);
  const ref = /^var\(--([\w-]+)\)$/.exec(value);
  return ref ? resolve(theme, ref[1]) : value;
}

function hslToRgb(value: string): [number, number, number] {
  const [h, s, l] = value.replace(/%/g, "").split(/\s+/).map(Number);
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(theme: Theme, fg: string, bg: string): number {
  const [a, b] = [fg, bg].map((n) => luminance(hslToRgb(resolve(theme, n))));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Classi vietate: si usano brand / success / run (SYSTEM.md) e testo da 11 px in su */
const FORBIDDEN = /\b(?:[a-z-]+:)*(?:bg|text|stroke|fill|border|ring|from|to|via)-(?:lime|green|emerald)-\d{2,3}\b|#d4ff3a|text-\[(?:[1-9]|10)(?:\.\d+)?px\]/gi;

/** Superficie sempre scura (card di Oggi, riepilogo, profilo): zinc-950 */
const SLAB = { slab: "240 10% 4%" };

const TEXT_PAIRS: [fg: string, bg: string][] = [
  ["brand-strong", "background"],
  ["brand-strong", "card"],
  ["brand-foreground", "brand"],
  ["success", "background"],
  ["success", "card"],
  ["success-foreground", "success"],
  ["success-inverse", "foreground"],
  ["run-strong", "card"],
];

describe("token di colore", () => {
  for (const [name, theme] of [
    ["chiaro", light],
    ["scuro", dark],
  ] as const) {
    it.each(TEXT_PAIRS)(`tema ${name}: %s su %s >= 4,5:1`, (fg, bg) => {
      expect(contrast(theme, fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it(`tema ${name}: lime acceso sulle superfici scure`, () => {
      const t = { ...theme, ...SLAB };
      expect(contrast(t, "brand-bright", "slab")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t, "brand-foreground", "brand-bright")).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("nei componenti niente verdi scritti a mano né etichette sotto gli 11 px", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") walk(path);
        } else if (/\.tsx?$/.test(entry.name)) {
          const source = readFileSync(path, "utf8");
          for (const m of source.matchAll(FORBIDDEN)) offenders.push(`${relative(process.cwd(), path)}: ${m[0]}`);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });

  it("la corsa usa il colore del brand finché non ne ha uno suo", () => {
    expect(resolve(light, "run")).toBe(resolve(light, "brand"));
    expect(resolve(dark, "run")).toBe(resolve(dark, "brand"));
  });
});
