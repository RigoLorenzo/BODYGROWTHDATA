import { execSync } from "child_process";

const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

const fixedUrl = originalUrl.replace(/^postgres:/, "postgresql:");

console.log("🔄 Running prisma migrate deploy...");

try {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: fixedUrl, DIRECT_URL: fixedUrl },
    stdio: "inherit",
  });
  console.log("✅ Migration completed!");
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  process.exit(1);
}
