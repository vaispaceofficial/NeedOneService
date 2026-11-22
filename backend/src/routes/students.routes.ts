
import { Router, Request, Response } from "express";
import { pool } from "../config/database.js";

const router = Router();

// ================================================
// HELPERS
// ================================================

const getString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

const getOptionalString = (value: unknown): string | null =>
    getString(value) || null;

const getStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
        return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
    }

    return [];
};

const isValidMobile = (mobile: string): boolean =>
    /^[6-9]\d{9}$/.test(mobile);

const isValidEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const getLegalAcceptance = (body: Record<string, unknown>) => {
    const legal =
        body.legalAcceptance &&
        typeof body.legalAcceptance === "object" &&
        !Array.isArray(body.legalAcceptance)
            ? body.legalAcceptance as Record<string, unknown>
            : {};

    return {
        termsAccepted: body.termsAccepted === true || legal.termsAccepted === true,
        privacyAccepted: body.privacyAccepted === true || legal.privacyAccepted === true,
        acceptedAt: getOptionalString(legal.acceptedAt) || new Date().toISOString(),
        acceptedPolicyVersions: body.acceptedPolicyVersions ?? null,
        legalAcceptance: body.legalAcceptance ?? null,
    };
};

// Keep registration data in the existing application_data column.
// Never store the form's password or confirmPassword.
const buildApplicationData = (body: Record<string, unknown>) => ({
    fullName: getString(body.fullName),
    mobile: getString(body.mobile),
    whatsapp: getOptionalString(body.whatsapp),
    email: getString(body.email).toLowerCase(),
    dob: getOptionalString(body.dob),
    gender: getOptionalString(body.gender),

    address: getOptionalString(body.address),
    city: getOptionalString(body.city),
    state: getOptionalString(body.state),
    pincode: getOptionalString(body.pincode),

    educationLevel: getOptionalString(body.educationLevel),
    course: getOptionalString(body.course),
    institution: getOptionalString(body.institution),
    specialization: getOptionalString(body.specialization),
    graduationYear: getOptionalString(body.graduationYear),

    skills: getOptionalString(body.skills),
    experienceLevel: getOptionalString(body.experienceLevel),
    interestedAreas: getOptionalString(body.interestedAreas),

    learningFormat: getOptionalString(body.learningFormat),
    preferredMode: getOptionalString(body.preferredMode),
    preferredDays: getStringArray(body.preferredDays),
    preferredTime: getOptionalString(body.preferredTime),
    availability: getOptionalString(body.availability),
    learningGoals: getStringArray(body.learningGoals),
    careerGoal: getOptionalString(body.careerGoal),
    certificationInterest: getOptionalString(body.certificationInterest),

    profilePhotoName: getOptionalString(body.profilePhotoName),
    educationProofName: getOptionalString(body.educationProofName),
});

const sendStudentResponse = (
    student: Record<string, unknown>,
    res: Response,
    statusCode = 200
) => {
    const applicationData =
        student.application_data &&
        typeof student.application_data === "object"
            ? student.application_data as Record<string, unknown>
            : {};

    const status = String(student.status || "Pending Review");

    res.status(statusCode).json({
        success: true,
        student: {
            ...applicationData,
            id: student.id,
            studentId: student.id,
            fullName: student.full_name || applicationData.fullName || "",
            mobile: student.mobile || applicationData.mobile || "",
            email: student.email || applicationData.email || "",
            status,
            applicationStatus: status,
            submittedAt: student.submitted_at,
            createdAt: student.created_at,
            updatedAt: student.updated_at,
        },
    });
};

// ================================================
// REGISTER STUDENT APPLICATION
// POST /api/students/register
// ================================================

router.post("/register", async (req: Request, res: Response) => {
    try {
        const body = req.body as Record<string, unknown>;
        const applicationData = buildApplicationData(body);

        const { fullName, mobile, email } = applicationData;

        if (!fullName || !mobile || !email) {
            res.status(400).json({
                success: false,
                message: "Name, mobile and email are required.",
            });
            return;
        }

        if (!isValidMobile(mobile)) {
            res.status(400).json({
                success: false,
                message: "Enter a valid 10-digit Indian mobile number.",
            });
            return;
        }

        if (!isValidEmail(email)) {
            res.status(400).json({
                success: false,
                message: "Enter a valid email address.",
            });
            return;
        }

        if (fullName.length > 150 || email.length > 255) {
            res.status(400).json({
                success: false,
                message: "One or more registration fields are too long.",
            });
            return;
        }

        const legalAcceptance = getLegalAcceptance(body);

        if (!legalAcceptance.termsAccepted || !legalAcceptance.privacyAccepted) {
            res.status(400).json({
                success: false,
                message: "Terms & Conditions and Privacy Policy acceptance are required.",
            });
            return;
        }

        const duplicate = await pool.query(
            `SELECT id FROM students
             WHERE LOWER(email) = LOWER($1) OR mobile = $2
             LIMIT 1`,
            [email, mobile]
        );

        if (duplicate.rows.length > 0) {
            res.status(409).json({
                success: false,
                message: "A student registration already exists with this email or mobile number.",
            });
            return;
        }

        const result = await pool.query(
            `INSERT INTO students (
                full_name,
                mobile,
                email,
                status,
                application_data,
                legal_acceptance,
                profile_photo_name,
                education_proof_name,
                submitted_at,
                created_at,
                updated_at
            )
            VALUES (
                $1, $2, $3, 'Pending Review',
                $4::jsonb, $5::jsonb, $6, $7,
                NOW(), NOW(), NOW()
            )
            RETURNING
                id, full_name, mobile, email, status,
                application_data, submitted_at, created_at, updated_at`,
            [
                fullName,
                mobile,
                email,
                JSON.stringify(applicationData),
                JSON.stringify(legalAcceptance),
                applicationData.profilePhotoName,
                applicationData.educationProofName,
            ]
        );

        sendStudentResponse(result.rows[0], res, 201);
    } catch (error) {
        console.error("Student registration error:", error);

        const pgError = error as { code?: string };

        if (pgError.code === "23505") {
            res.status(409).json({
                success: false,
                message: "A student registration already exists with these details.",
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Unable to submit student registration.",
        });
    }
});

// ================================================
// STUDENT API HEALTH
// GET /api/students/health
// ================================================

router.get("/health", async (_req: Request, res: Response) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            success: true,
            message: "Student API is connected to PostgreSQL.",
        });
    } catch (error) {
        console.error("Student API health error:", error);

        res.status(500).json({
            success: false,
            message: "Student API database connection failed.",
        });
    }
});

// ================================================
// GET STUDENT APPLICATION
// GET /api/students/:id
// ================================================

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);

        if (!/^\d+$/.test(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid student ID.",
            });
            return;
        }

        const result = await pool.query(
            `SELECT
                id, full_name, mobile, email, status,
                application_data, submitted_at, created_at, updated_at
             FROM students
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Student application was not found.",
            });
            return;
        }

        sendStudentResponse(result.rows[0], res);
    } catch (error) {
        console.error("Student retrieval error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve student application.",
        });
    }
});

// ================================================
// UPDATE STUDENT APPLICATION PROFILE
// PUT /api/students/:id
// ================================================

router.put("/:id", async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);

        if (!/^\d+$/.test(id)) {
            res.status(400).json({
                success: false,
                message: "Invalid student ID.",
            });
            return;
        }

        const currentResult = await pool.query(
            `SELECT
                id, full_name, mobile, email, status,
                application_data, submitted_at, created_at, updated_at
             FROM students
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (currentResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Student application was not found.",
            });
            return;
        }

        const current = currentResult.rows[0];

        const currentData =
            current.application_data &&
            typeof current.application_data === "object"
                ? current.application_data as Record<string, unknown>
                : {};

        const body = req.body as Record<string, unknown>;

        const allowedFields = [
            "fullName", "mobile", "whatsapp", "email",
            "dob", "gender", "address", "city", "state", "pincode",
            "educationLevel", "course", "institution", "specialization",
            "currentYear", "graduationYear", "studentId",
            "skills", "experienceLevel", "interestedAreas",
            "preferredLanguage", "learningFormat", "preferredMode",
            "learningMode", "preferredDays", "preferredTime",
            "availability", "learningGoals", "weeklyHours",
            "careerGoal", "certificationInterest", "additionalDetails",
        ];

        const updatedData: Record<string, unknown> = { ...currentData };

        for (const key of allowedFields) {
            if (!Object.prototype.hasOwnProperty.call(body, key)) continue;

            if (["preferredDays", "learningGoals"].includes(key)) {
                updatedData[key] = getStringArray(body[key]);
            } else if (["skills", "interestedAreas"].includes(key)) {
                updatedData[key] = Array.isArray(body[key])
                    ? getStringArray(body[key]).join(", ")
                    : getString(body[key]);
            } else {
                updatedData[key] = getString(body[key]);
            }
        }

        const fullName = getString(updatedData.fullName || current.full_name);
        const mobile = getString(updatedData.mobile || current.mobile);
        const email = getString(updatedData.email || current.email).toLowerCase();

        if (!fullName || !mobile || !email) {
            res.status(400).json({
                success: false,
                message: "Name, mobile and email cannot be empty.",
            });
            return;
        }

        if (!isValidMobile(mobile) || !isValidEmail(email)) {
            res.status(400).json({
                success: false,
                message: "Enter a valid mobile number and email address.",
            });
            return;
        }

        if (fullName.length > 150 || email.length > 255) {
            res.status(400).json({
                success: false,
                message: "One or more profile fields are too long.",
            });
            return;
        }

        const duplicate = await pool.query(
            `SELECT id FROM students
             WHERE id <> $1
               AND (LOWER(email) = LOWER($2) OR mobile = $3)
             LIMIT 1`,
            [id, email, mobile]
        );

        if (duplicate.rows.length > 0) {
            res.status(409).json({
                success: false,
                message: "That email or mobile number is already registered.",
            });
            return;
        }

        updatedData.fullName = fullName;
        updatedData.mobile = mobile;
        updatedData.email = email;

        const result = await pool.query(
            `UPDATE students
             SET
                full_name = $1,
                mobile = $2,
                email = $3,
                application_data = $4::jsonb,
                updated_at = NOW()
             WHERE id = $5
             RETURNING
                id, full_name, mobile, email, status,
                application_data, submitted_at, created_at, updated_at`,
            [
                fullName,
                mobile,
                email,
                JSON.stringify(updatedData),
                id,
            ]
        );

        sendStudentResponse(result.rows[0], res);
    } catch (error) {
        console.error("Student profile update error:", error);

        const pgError = error as { code?: string };

        if (pgError.code === "23505") {
            res.status(409).json({
                success: false,
                message: "That email or mobile number is already registered.",
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: "Unable to save student profile changes.",
        });
    }
});

export default router;
