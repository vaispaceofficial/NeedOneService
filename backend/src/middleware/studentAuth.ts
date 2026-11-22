
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const STUDENT_COOKIE_NAME = "nos_student_token";

const STUDENT_JWT_ISSUER = "needoneservice-api";
const STUDENT_JWT_AUDIENCE = "needoneservice-student";

export const getStudentJwtSecret = (): string => {
    const secret = process.env.STUDENT_JWT_SECRET;

    if (!secret || secret.length < 64) {
        throw new Error(
            "STUDENT_JWT_SECRET must be configured with at least 64 characters."
        );
    }

    return secret;
};

export const studentCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
});

export const clearStudentCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
});

export const studentAuth = (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = _req.cookies?.[STUDENT_COOKIE_NAME];

        if (!token) {
            res.status(401).json({
                success: false,
                message: "Student login is required.",
            });
            return;
        }

        const decoded = jwt.verify(token, getStudentJwtSecret(), {
            algorithms: ["HS256"],
            issuer: STUDENT_JWT_ISSUER,
            audience: STUDENT_JWT_AUDIENCE,
        });

        if (
            typeof decoded === "string" ||
            !decoded.sub ||
            decoded.role !== "student"
        ) {
            res.status(401).json({
                success: false,
                message: "Invalid student session.",
            });
            return;
        }

        res.locals.studentId = decoded.sub;

        next();
    } catch {
        res.status(401).json({
            success: false,
            message: "Your student session is invalid or has expired. Please log in again.",
        });
    }
};
