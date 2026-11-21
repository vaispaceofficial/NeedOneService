
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { pool } from "./config/database.js";

import complianceRoutes from "./routes/compliance.routes.js";
import legalDocumentsRoutes from "./routes/legalDocuments.routes.js";

dotenv.config();

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

// ================================================
// API ROUTES
// ================================================

// Compliance management
app.use(
  "/api/admin/compliance",
  complianceRoutes
);

// Legal documents management
app.use(
  "/api/legal-documents",
  legalDocumentsRoutes
);

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
    console.error(
      "Database health check failed:",
      error
    );

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
