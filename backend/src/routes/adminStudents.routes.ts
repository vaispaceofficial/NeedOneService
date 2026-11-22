
import { Router, Request, Response } from "express";
import { pool } from "../config/database.js";

const router = Router();

const validStatuses = [
    "Pending Review",
    "Approved",
    "Rejected",
    "Suspended",
];

const isValidId = (id: string) => /^\d+$/.test(id) && Number(id) > 0;

// ================================================
// GET STUDENT STATISTICS
// ================================================

router.get("/stats", async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (
                    WHERE status = 'Pending Review'
                ) AS pending,
                COUNT(*) FILTER (
                    WHERE status = 'Approved'
                ) AS approved,
                COUNT(*) FILTER (
                    WHERE status = 'Rejected'
                ) AS rejected,
                COUNT(*) FILTER (
                    WHERE status = 'Suspended'
                ) AS suspended
            FROM students
        `);

        res.json({
            success: true,
            stats: result.rows[0],
        });
    } catch (error) {
        console.error("Student statistics error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch student statistics.",
        });
    }
});

// ================================================
// GET ALL STUDENTS
// Supports search, status filter and pagination
// ================================================

router.get("/", async (req: Request, res: Response) => {
    try {
        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "").trim();

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(
            100,
            Math.max(1, Number(req.query.limit) || 20)
        );
        const offset = (page - 1) * limit;

        if (status && !validStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                message: "Invalid student status.",
            });
            return;
        }

        const result = await pool.query(
            `
            SELECT
                id,
                full_name,
                mobile,
                email,
                status,
                profile_photo_name,
                education_proof_name,
                submitted_at,
                created_at,
                updated_at
            FROM students
            WHERE
                (
                    $1 = ''
                    OR full_name ILIKE '%' || $1 || '%'
                    OR mobile ILIKE '%' || $1 || '%'
                    OR email ILIKE '%' || $1 || '%'
                )
                AND ($2 = '' OR status = $2)
            ORDER BY submitted_at DESC
            LIMIT $3 OFFSET $4
            `,
            [search, status, limit, offset]
        );

        const countResult = await pool.query(
            `
            SELECT COUNT(*) AS total
            FROM students
            WHERE
                (
                    $1 = ''
                    OR full_name ILIKE '%' || $1 || '%'
                    OR mobile ILIKE '%' || $1 || '%'
                    OR email ILIKE '%' || $1 || '%'
                )
                AND ($2 = '' OR status = $2)
            `,
            [search, status]
        );

        res.json({
            success: true,
            students: result.rows,
            pagination: {
                page,
                limit,
                total: Number(countResult.rows[0].total),
                totalPages: Math.ceil(
                    Number(countResult.rows[0].total) / limit
                ),
            },
        });
    } catch (error) {
        console.error("Fetch students error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch students.",
        });
    }
});

// ================================================
// GET SINGLE STUDENT — FULL PROFILE
// ================================================

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);

        if (!isValidId(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid student ID.",
            });
            return;
        }

        const result = await pool.query(
            `
            SELECT *
            FROM students
            WHERE id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Student not found.",
            });
            return;
        }

        res.json({
            success: true,
            student: result.rows[0],
        });
    } catch (error) {
        console.error("Fetch student profile error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch student profile.",
        });
    }
});

// ================================================
// UPDATE STUDENT DETAILS
// ================================================

router.put("/:id", async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);

        if (!isValidId(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid student ID.",
            });
            return;
        }

        const fullName =
            req.body.full_name !== undefined
                ? String(req.body.full_name).trim()
                : undefined;

        const mobile =
            req.body.mobile !== undefined
                ? String(req.body.mobile).trim()
                : undefined;

        const email =
            req.body.email !== undefined
                ? String(req.body.email).trim().toLowerCase()
                : undefined;

        const applicationData = req.body.application_data;

        if (
            fullName === undefined &&
            mobile === undefined &&
            email === undefined &&
            applicationData === undefined
        ) {
            res.status(400).json({
                success: false,
                message: "No student details were provided for update.",
            });
            return;
        }

        if (fullName !== undefined && !fullName) {
            res.status(400).json({
                success: false,
                message: "Student name cannot be empty.",
            });
            return;
        }

        if (
            mobile !== undefined &&
            !/^[6-9]\d{9}$/.test(mobile)
        ) {
            res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian mobile number.",
            });
            return;
        }

        if (
            email !== undefined &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            res.status(400).json({
                success: false,
                message: "Enter a valid email address.",
            });
            return;
        }

        if (
            applicationData !== undefined &&
            (
                applicationData === null ||
                typeof applicationData !== "object" ||
                Array.isArray(applicationData)
            )
        ) {
            res.status(400).json({
                success: false,
                message: "Application data must be a valid object.",
            });
            return;
        }

        const result = await pool.query(
            `
            UPDATE students
            SET
                full_name = COALESCE($1, full_name),
                mobile = COALESCE($2, mobile),
                email = COALESCE($3, email),
                application_data = COALESCE($4::jsonb, application_data),
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
            `,
            [
                fullName ?? null,
                mobile ?? null,
                email ?? null,
                applicationData === undefined
                    ? null
                    : JSON.stringify(applicationData),
                id,
            ]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Student not found.",
            });
            return;
        }

        res.json({
            success: true,
            message: "Student details updated successfully.",
            student: result.rows[0],
        });
    } catch (error: any) {
        if (error.code === "23505") {
            res.status(409).json({
                success: false,
                message: "This email or mobile number is already registered.",
            });
            return;
        }

        console.error("Update student error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update student details.",
        });
    }
});

// ================================================
// UPDATE STUDENT APPLICATION STATUS
// Approve, reject, suspend or restore to pending
// ================================================

router.patch("/:id/status", async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const status = String(req.body.status || "").trim();

        if (!isValidId(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid student ID.",
            });
            return;
        }

        if (!validStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                message: "Invalid status. Choose Pending Review, Approved, Rejected or Suspended.",
            });
            return;
        }

        const result = await pool.query(
            `
            UPDATE students
            SET
                status = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
            `,
            [status, id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Student not found.",
            });
            return;
        }

        res.json({
            success: true,
            message: `Student status changed to ${status}.`,
            student: result.rows[0],
        });
    } catch (error) {
        console.error("Update student status error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update student status.",
        });
    }
});

export default router;
