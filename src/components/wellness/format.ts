/** Scala dello stress (1-100, simile per Xiaomi e Garmin) */
export const stressLabel = (v: number) => (v < 30 ? "rilassato" : v < 60 ? "normale" : v < 80 ? "medio-alto" : "alto");
