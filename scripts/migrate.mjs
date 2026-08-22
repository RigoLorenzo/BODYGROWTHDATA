import { execSync } from "child_process";

const normalize = (url) => url?.replace(/^postgres(?!ql):\/\//, "postgresql://");
const isPostgresUrl = (url) => /^postgres(ql)?:\/\//.test(url ?? "");

// ── DATABASE_URL ────────────────────────────────────────────────────────────
const rawDbUrl = process.env.DATABASE_URL;
if (!rawDbUrl) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}
process.env.DATABASE_URL = normalize(rawDbUrl);

// ── DIRECT_URL ──────────────────────────────────────────────────────────────
// Only use DIRECT_URL if it's actually a postgres URL.
// If it's missing or holds a non-URL value (endpoint name, placeholder, etc.)
// delete it so Prisma falls back to DATABASE_URL for everything.
const rawDirectUrl = process.env.DIRECT_URL;
if (rawDirectUrl && isPostgresUrl(rawDirectUrl)) {
  process.env.DIRECT_URL = normalize(rawDirectUrl);
  console.log(`🔗 DATABASE_URL: ${process.env.DATABASE_URL.split("://")[0]}://***`);
  console.log(`🔗 DIRECT_URL:   ${process.env.DIRECT_URL.split("://")[0]}://***`);
} else {
  delete process.env.DIRECT_URL;
  console.log(`🔗 DATABASE_URL: ${process.env.DATABASE_URL.split("://")[0]}://***`);
  console.log(`⚠️  DIRECT_URL not set or not a postgres URL — Prisma will use DATABASE_URL`);
}

console.log("🔄 Running prisma db push...");

try {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
  console.log("✅ Schema pushed!");
} catch (error) {
  console.error("❌ Schema push failed:", error.message);
  process.exit(1);
}

// Libreria esercizi e obiettivi: upsert idempotente, così ogni deploy allinea
// il catalogo senza bisogno di chiamare /api/setup a mano.
console.log("🌱 Seeding exercise library...");
try {
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
} catch (error) {
  // Un seed fallito non deve bloccare il deploy: l'app resta usabile e la
  // libreria si può ricaricare dalle impostazioni.
  console.error("⚠️  Seed failed (deploy continues):", error.message);
}
