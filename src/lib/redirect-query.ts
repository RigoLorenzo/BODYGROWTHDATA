/** Ricostruisce la query di una pagina (searchParams di Next) per un reindirizzamento */
export function toQuery(params: Record<string, string | string[] | undefined>, overrides: Record<string, string> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    for (const v of Array.isArray(value) ? value : [value]) query.append(key, v);
  }
  for (const [key, value] of Object.entries(overrides)) query.set(key, value);
  const text = query.toString();
  return text ? `?${text}` : "";
}
