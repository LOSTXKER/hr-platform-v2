import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Ensure DATABASE_URL is populated when loaded from CLI scripts (tsx) before any
// dotenv config in the script. Idempotent: dotenv.config() does not override
// existing env vars, so this is safe in Next.js runtime where vars come from .env.local
// loaded by Next itself.
if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  try {
    const { config } = require("dotenv") as typeof import("dotenv");
    config({ path: ".env.local" });
    config({ path: ".env" });
  } catch {
    // dotenv not available — runtime env must be provided externally
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // adapter-pg uses raw pg driver — pgbouncer=true URL flag (intended for Prisma engine) is not
  // recognized here. Use DIRECT_URL when available so the driver gets a clean connection string.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
