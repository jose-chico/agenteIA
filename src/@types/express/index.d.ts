import "express";

declare global {
  namespace Express {
    interface Request {
      userId?: number; // Se o seu JWT guarda o ID como número
    }
  }
}