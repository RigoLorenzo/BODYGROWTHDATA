/** "+4 bpm sulla norma" / "nella tua norma" */
export function heartDetail(delta: number | null): string | undefined {
  if (delta == null) return undefined;
  if (Math.abs(delta) < 1) return "nella tua norma";
  return `${delta > 0 ? "+" : "−"}${Math.round(Math.abs(delta))} bpm sulla norma`;
}

/** Scala dello stress Xiaomi (1-100) */
export const stressLabel = (v: number) => (v < 30 ? "rilassato" : v < 60 ? "normale" : v < 80 ? "medio-alto" : "alto");
