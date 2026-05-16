import { execSync } from "child_process";

// Vercel/Neon generate postgres:// but Prisma CLI requires postgresql://
const normalize = (url) => url?.replace(/^postgres(?!ql):\/\//, "postgresql://");

const poolerUrl = normalize(process.env.DATABASE_URL);
const directUrl = normalize(process.env.DIRECT_URL) ?? poolerUrl;

if (!poolerUrl) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

// Log scheme only (never log credentials)
console.log(`🔗 DATABASE_URL scheme: ${poolerUrl.split("://")[0]}`);
console.log(`🔗 DIRECT_URL scheme:   ${directUrl.split("://")[0]}`);

// Mutate process.env directly — more reliable than passing { env } to execSync
// because Prisma CLI's own dotenv loader can override a child-process env object.
// Use DIRECT_URL for schema operations: pgbouncer/pooler connections
// don't support DDL statements required by db push.
process.env.DATABASE_URL = directUrl;
process.env.DIRECT_URL = directUrl;

console.log("🔄 Running prisma db push...");

try {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
  console.log("✅ Schema pushed!");
} catch (error) {
  console.error("❌ Schema push failed:", error.message);
  process.exit(1);
}
