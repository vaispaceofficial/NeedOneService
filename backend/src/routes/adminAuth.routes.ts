
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  ADMIN_COOKIE_NAME,
  getAdminJwtSecret,
} from "../middleware/adminAuth.js";

const router = Router();

const TOKEN_EXPIRY = "8h";
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000;

const JWT_ISSUER = "needoneservice-api";
const JWT_AUDIENCE = "needoneservice-admin";

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: COOKIE_MAX_AGE,
  path: "/",
});

// Prevent browser caching of authentication responses.
const preventCaching = (res: Response) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
};

// ================================================
// ADMIN LOGIN
// POST /api/admin/auth/login
// ================================================

router.post("/login", async (req: Request, res: Response) => {
  preventCaching(res);

  try {
    const adminId = String(req.body?.adminId || "").trim();
    const password = String(req.body?.password || "");

    if (!adminId || !password) {
      res.status(400).json({
        success: false,
        message: "Admin ID and password are required.",
      });
      return;
    }

    const configuredAdminId = process.env.ADMIN_ID;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!configuredAdminId || !passwordHash) {
      res.status(503).json({
        success: false,
        message: "Admin authentication is not configured.",
      });
      return;
    }

    const secret = getAdminJwtSecret();

    const validId = adminId === configuredAdminId;

    const validPassword = await bcrypt.compare(
      password,
      passwordHash
    );

    if (!validId || !validPassword) {
      res.status(401).json({
        success: false,
        message: "Invalid admin ID or password.",
      });
      return;
    }

    const token = jwt.sign(
      {
        role: "admin",
      },
      secret,
      {
        subject: configuredAdminId,
        expiresIn: TOKEN_EXPIRY,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithm: "HS256",
      }
    );

    res.cookie(
      ADMIN_COOKIE_NAME,
      token,
      getCookieOptions()
    );

    res.json({
      success: true,
      message: "Admin login successful.",
      admin: {
        adminId: configuredAdminId,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to complete admin login.",
    });
  }
});

// ================================================
// ADMIN LOGOUT
// POST /api/admin/auth/logout
// ================================================

router.post("/logout", (_req: Request, res: Response) => {
  preventCaching(res);

  res.clearCookie(
    ADMIN_COOKIE_NAME,
    getCookieOptions()
  );

  res.json({
    success: true,
    message: "Admin logged out successfully.",
  });
});

// ================================================
// CHECK ADMIN SESSION
// GET /api/admin/auth/me
// ================================================

router.get("/me", (req: Request, res: Response) => {
  preventCaching(res);

  try {
    const token = req.cookies?.[ADMIN_COOKIE_NAME];

    if (!token || typeof token !== "string") {
      res.status(401).json({
        success: false,
        authenticated: false,
        message: "Admin session not found.",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      getAdminJwtSecret(),
      {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }
    ) as jwt.JwtPayload;

    if (
      decoded.role !== "admin" ||
      decoded.sub !== process.env.ADMIN_ID
    ) {
      res.status(401).json({
        success: false,
        authenticated: false,
        message: "Invalid admin session.",
      });
      return;
    }

    res.json({
      success: true,
      authenticated: true,
      admin: {
        adminId: decoded.sub,
        role: decoded.role,
      },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        authenticated: false,
        message: "Admin session has expired or is invalid.",
      });
      return;
    }

    console.error("Admin session verification error:", error);

    res.status(500).json({
      success: false,
      authenticated: false,
      message: "Could not verify admin session.",
    });
  }
});

export default router;
