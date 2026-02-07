"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Evita que o Prisma Client abra múltiplas conexões em desenvolvimento
const globalForPrisma = global;
exports.prisma = globalForPrisma.prisma ||
    new client_1.PrismaClient({
        log: ["query", "error", "warn"], // Opcional: mostra os comandos no console (bom para debug)
    });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
