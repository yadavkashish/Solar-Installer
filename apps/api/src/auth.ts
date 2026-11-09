import crypto from "node:crypto";
import argon2 from "argon2";
import type { Request, Response, NextFunction } from "express";
import { db } from "./repository.js";
import { databaseUnavailableResponse } from "./db-errors.js";
import { canSignIn } from "./account-activation.js";
export { canSignIn } from "./account-activation.js";
export type Principal = {
  id: string;
  role: "HOMEOWNER" | "SALES";
  email: string;
};
declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
export const sessionTokenHash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const activationTokenHash = sessionTokenHash;
export const createActivationToken = () =>
  crypto.randomBytes(32).toString("base64url");
export async function signIn(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (
    !user ||
    !canSignIn(user) ||
    !(await argon2.verify(user.passwordHash, password))
  )
    return null;
  const token = crypto.randomBytes(32).toString("base64url");
  const csrf = crypto.randomBytes(24).toString("base64url");
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: sessionTokenHash(token),
      csrfSecret: csrf,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
  return {
    token,
    csrf,
    user: { id: user.id, role: user.role, email: user.email },
  };
}
export function session(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    try {
    const token = req.cookies.session;
    if (!token) return res.status(401).json({ error: "Sign in required" });
    const row = await db.session.findFirst({
      where: {
        tokenHash: sessionTokenHash(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!row) return res.status(401).json({ error: "Session expired" });
    req.principal = {
      id: row.user.id,
      role: row.user.role,
      email: row.user.email,
    };
    next();
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error);
    if (unavailable)
      return res.status(unavailable.status).json(unavailable.body);
      next(error);
    }
  })();
}
export async function logout(req: Request, res: Response) {
  const token = req.cookies.session;
  if (token)
    await db.session.updateMany({
      where: { tokenHash: sessionTokenHash(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  res.clearCookie("session");
  res.sendStatus(204);
}
export function csrf(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    try {
      if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
      const token = req.cookies.session;
      const value = req.header("x-csrf-token");
      if (!token || !value)
        return res.status(403).json({ error: "CSRF token required" });
      const row = await db.session.findFirst({
        where: {
          tokenHash: sessionTokenHash(token),
          csrfSecret: value,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!row) return res.status(403).json({ error: "Invalid CSRF token" });
      next();
    } catch (error) {
      next(error);
    }
  })();
}
export function role(...roles: Principal["role"][]) {
  return (req: Request, res: Response, next: NextFunction) =>
    !req.principal || !roles.includes(req.principal.role)
      ? res.sendStatus(403)
      : next();
}
export function ownsLead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  void (async () => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const lead = await db.lead.findUnique({ where: { id } });
      if (!lead) return res.sendStatus(404);
      if (req.principal?.role === "HOMEOWNER" && lead.ownerId !== req.principal.id)
        return res.sendStatus(403);
      next();
    } catch (error) {
      next(error);
    }
  })();
}
