
import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { pool } from "./config/database.js";

// Routes
import complianceRoutes from "./routes/compliance.routes.js";
import legalDocumentsRoutes from "./routes/legalDocuments.routes.js";
import registrationConsentRoutes from "./routes/registrationConsent.routes.js";
import studentsRoutes from "./routes/students.routes.js";
import adminAuthRoutes from "./routes/adminAuth.routes.js";
import adminStudentsRoutes from "./routes/adminStudents.routes.js";

// Authentication middleware
import { adminAuth } from "./middleware/adminAuth.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ================================================
// MIDDLEWARE
// ================================================

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

// ================================================
// ADMIN AUTHENTICATION
// ================================================

// Public login, logout and session verification.
app.use("/api/admin/auth", adminAuthRoutes);

// ================================================
// PROTECTED ADMIN ROUTES
// ================================================

// Compliance management
app.use(
    "/api/admin/compliance",
    adminAuth,
    complianceRoutes
);

// Student administration
app.use(
    "/api/admin/students",
    adminAuth,
    adminStudentsRoutes
);

// ================================================
// EXISTING PUBLIC ROUTES
// ================================================

// Legal documents
app.use("/api/legal-documents", legalDocumentsRoutes);

// Registration consent
app.use("/api/registration-consents", registrationConsentRoutes);

// Public student registration
app.use("/api/students", studentsRoutes);

// ================================================
// ROOT API
// ================================================

app.get("/", (_req, res) => {
    res.json({
        success: true,
        message: "Need One Service API is running",
    });
});

// ================================================
// DATABASE HEALTH CHECK
// ================================================

app.get("/api/health", async (_req, res) => {
    try {
        const result = await pool.query(
            "SELECT NOW() AS database_time"
        );

        res.json({
            success: true,
            status: "healthy",
            service: "Need One Service Backend",
            database: "connected",
            databaseTime: result.rows[0].database_time,
        });
    } catch (error) {
        console.error("Database health check failed:", error);

        res.status(500).json({
            success: false,
            status: "unhealthy",
            database: "disconnected",
            message: "Could not connect to PostgreSQL",
        });
    }
});

// ================================================
// START SERVER
// ================================================

app.listen(PORT, () => {
    console.log(
        `Need One Service API running on port ${PORT}`
    );
});
