// Normalizes postgres:// → postgresql:// before running prisma migrate deploy.
// Vercel/Neon auto-generate postgres:// URLs but Prisma requires postgresql://.
import { execSync } from "child_process";

const env = { ...process.env };

const normalize = (url) => url?.replace(/^postgres:/, "postgresql:");

env.DATABASE_URL = normalize(env.DATABASE_URL);
env.DIRECT_URL = normalize(env.DIRECT_URL) ?? env.DATABASE_URL;

if (!env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

console.log("🔄 Running prisma migrate deploy...");
execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
console.log("✅ Migrations complete");
