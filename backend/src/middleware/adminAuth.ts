
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export const ADMIN_COOKIE_NAME = "nos_admin_token";

export interface AdminSession {
  id: string;
  role: "admin";
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminSession;
    }
  }
}

interface AdminTokenPayload extends JwtPayload {
  sub: string;
  role: "admin";
}

export function getAdminJwtSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret || secret.length < 64) {
    throw new Error(
      "ADMIN_JWT_SECRET is missing or too short. Configure a secure secret in .env."
    );
  }

  return secret;
}

export function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = req.cookies?.[ADMIN_COOKIE_NAME];

    if (!token || typeof token !== "string") {
      res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
      return;
    }

    const decoded = jwt.verify(token, getAdminJwtSecret(), {
      algorithms: ["HS256"],
      issuer: "needoneservice-api",
      audience: "needoneservice-admin",
    });

    if (
      typeof decoded === "string" ||
      !decoded.sub ||
      decoded.role !== "admin"
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid admin session.",
      });
      return;
    }

    const payload = decoded as AdminTokenPayload;

    req.admin = {
      id: payload.sub,
      role: "admin",
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Your admin session is invalid or has expired. Please sign in again.",
      });
      return;
    }

    console.error("Admin authentication error:", error);

    res.status(500).json({
      success: false,
      message: "Could not verify admin authentication.",
    });
  }
}
