/** URL pubblico dell'app (per redirect OAuth e webhook) */
export function appUrl(req: Request): string {
  const fromEnv = process.env.APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  return `${proto}://${host}`;
}
