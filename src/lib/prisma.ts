import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Vercel/Neon generate postgres:// but Prisma requires postgresql://
function normalizeDbUrl(url: string | undefined): string | undefined {
  return url?.replace(/^postgres:/, "postgresql:");
}

const databaseUrl = normalizeDbUrl(process.env.DATABASE_URL);

if (!databaseUrl) throw new Error("DATABASE_URL is not defined");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
