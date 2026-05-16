import { execSync } from "child_process";

const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) {
  console.error("❌ DATABASE_URL is not defined");
  process.exit(1);
}

const fixedUrl = originalUrl.replace(/^postgres:/, "postgresql:");
const directUrl = (process.env.DIRECT_URL ?? originalUrl).replace(/^postgres:/, "postgresql:");

const env = { ...process.env, DATABASE_URL: fixedUrl, DIRECT_URL: directUrl };

console.log("🔄 Pushing schema to database (prisma db push)...");

try {
  execSync("npx prisma db push --skip-generate", { env, stdio: "inherit" });
  console.log("✅ Schema pushed successfully!");
} catch (error) {
  console.error("❌ Schema push failed:", error.message);
  process.exit(1);
}
