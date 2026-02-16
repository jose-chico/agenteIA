import { PrismaClient } from "@prisma/client";

// Evita que o Prisma Client abra múltiplas conexões em desenvolvimento
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // Opcional: mostra os comandos no console (bom para debug)
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;