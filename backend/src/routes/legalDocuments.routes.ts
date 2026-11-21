
import { Router, Request, Response } from "express";
import { pool } from "../config/database.js";

const router = Router();

// ================================================
// VALID VALUES
// ================================================

const validPartnerTypes = [
  "Professional",
  "Vendor",
  "Marketplace Seller",
  "Customer",
  "Student",
];

const validDocumentTypes = [
  "Terms & Conditions",
  "Privacy Policy",
];

const isValidPartnerType = (value: string): boolean =>
  validPartnerTypes.includes(value);

const isValidDocumentType = (value: string): boolean =>
  validDocumentTypes.includes(value);

// ================================================
// ROUTE PARAMETER HELPER
// Handles Express string | string[] parameters
// ================================================

const getRouteParam = (
  value: string | string[] | undefined
): string => {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

// ================================================
// GET ALL LEGAL DOCUMENTS (ADMIN)
// GET /api/legal-documents/admin
// ================================================

router.get(
  "/admin",
  async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT
          id,
          partner_type,
          document_type,
          title,
          content,
          status,
          current_version,
          updated_at
        FROM policy_documents
        ORDER BY
          CASE partner_type
            WHEN 'Professional' THEN 1
            WHEN 'Vendor' THEN 2
            WHEN 'Marketplace Seller' THEN 3
            WHEN 'Customer' THEN 4
            WHEN 'Student' THEN 5
            ELSE 6
          END,
          document_type`
      );

      res.json({
        success: true,
        documents: result.rows,
      });
    } catch (error) {
      console.error("Fetch legal documents error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to fetch legal documents.",
      });
    }
  }
);

// ================================================
// SAVE LEGAL DOCUMENT AS DRAFT
// PUT /api/legal-documents/admin/:partnerType/:documentType
// ================================================

router.put(
  "/admin/:partnerType/:documentType",
  async (req: Request, res: Response) => {
    try {
      const partnerType = getRouteParam(
        req.params.partnerType
      );

      const documentType = getRouteParam(
        req.params.documentType
      );

      const { title, content } = req.body;

      if (
        !isValidPartnerType(partnerType) ||
        !isValidDocumentType(documentType)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid partner category or document type.",
        });
        return;
      }

      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof content !== "string" ||
        !content.trim()
      ) {
        res.status(400).json({
          success: false,
          message: "Document title and content are required.",
        });
        return;
      }

      const result = await pool.query(
        `INSERT INTO policy_documents (
          partner_type,
          document_type,
          title,
          content,
          status,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'Draft', NOW())
        ON CONFLICT (partner_type, document_type)
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          status = 'Draft',
          updated_at = NOW()
        RETURNING
          id,
          partner_type,
          document_type,
          title,
          content,
          status,
          current_version,
          updated_at`,
        [
          partnerType,
          documentType,
          title.trim(),
          content.trim(),
        ]
      );

      res.json({
        success: true,
        message: "Legal document saved as draft.",
        document: result.rows[0],
      });
    } catch (error) {
      console.error("Save legal document error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to save legal document.",
      });
    }
  }
);

// ================================================
// PUBLISH LEGAL DOCUMENT
// POST /api/legal-documents/admin/:partnerType/:documentType/publish
// ================================================

router.post(
  "/admin/:partnerType/:documentType/publish",
  async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      const partnerType = getRouteParam(
        req.params.partnerType
      );

      const documentType = getRouteParam(
        req.params.documentType
      );

      if (
        !isValidPartnerType(partnerType) ||
        !isValidDocumentType(documentType)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid partner category or document type.",
        });
        return;
      }

      await client.query("BEGIN");

      const documentResult = await client.query(
        `SELECT *
         FROM policy_documents
         WHERE partner_type = $1
           AND document_type = $2
         FOR UPDATE`,
        [partnerType, documentType]
      );

      if (documentResult.rows.length === 0) {
        await client.query("ROLLBACK");

        res.status(404).json({
          success: false,
          message:
            "Legal document not found. Save it as a draft first.",
        });
        return;
      }

      const document = documentResult.rows[0];

      if (
        !document.title?.trim() ||
        !document.content?.trim()
      ) {
        await client.query("ROLLBACK");

        res.status(400).json({
          success: false,
          message:
            "Document title and content are required before publishing.",
        });
        return;
      }

      const nextVersion =
        Number(document.current_version || 0) + 1;

      // Save an immutable published version.
      const versionResult = await client.query(
        `INSERT INTO policy_document_versions (
          policy_document_id,
          version_number,
          title,
          content,
          published_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *`,
        [
          document.id,
          nextVersion,
          document.title,
          document.content,
        ]
      );

      // Update the current published version.
      const updatedResult = await client.query(
        `UPDATE policy_documents
         SET
           status = 'Published',
           current_version = $3,
           published_at = NOW(),
           updated_at = NOW()
         WHERE partner_type = $1
           AND document_type = $2
         RETURNING *`,
        [
          partnerType,
          documentType,
          nextVersion,
        ]
      );

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Legal document published successfully.",
        document: updatedResult.rows[0],
        version: versionResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Publish legal document error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to publish legal document.",
      });
    } finally {
      client.release();
    }
  }
);

// ================================================
// GET PUBLISHED DOCUMENTS FOR REGISTRATION
// GET /api/legal-documents/published/:partnerType
// ================================================

router.get(
  "/published/:partnerType",
  async (req: Request, res: Response) => {
    try {
      const partnerType = getRouteParam(
        req.params.partnerType
      );

      if (!isValidPartnerType(partnerType)) {
        res.status(400).json({
          success: false,
          message: "Invalid partner category.",
        });
        return;
      }

      const result = await pool.query(
        `SELECT
          d.id AS document_id,
          d.partner_type,
          d.document_type,
          v.title,
          v.content,
          v.version_number,
          v.published_at
        FROM policy_documents d
        INNER JOIN policy_document_versions v
          ON v.policy_document_id = d.id
          AND v.version_number = d.current_version
        WHERE d.partner_type = $1
          AND d.current_version > 0
        ORDER BY d.document_type`,
        [partnerType]
      );

      res.json({
        success: true,
        partnerType,
        documents: result.rows,
      });
    } catch (error) {
      console.error(
        "Fetch published legal documents error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Unable to fetch published legal documents.",
      });
    }
  }
);

export default router;
