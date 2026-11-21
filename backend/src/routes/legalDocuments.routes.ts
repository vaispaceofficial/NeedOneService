
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


// ================================================
// RECORD VENDOR REGISTRATION POLICY ACCEPTANCE
// POST /api/legal-documents/acceptance/vendor
// ================================================

router.post(
  "/acceptance/vendor",
  async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
      const {
        partner_id,
        partner_name,
        email,
        phone,
        termsDocumentId,
        termsVersion,
        privacyDocumentId,
        privacyVersion,
      } = req.body;

      const termsId = Number(termsDocumentId);
      const termsVer = Number(termsVersion);
      const privacyId = Number(privacyDocumentId);
      const privacyVer = Number(privacyVersion);

      if (
        typeof partner_name !== "string" ||
        !partner_name.trim() ||
        !Number.isInteger(termsId) ||
        termsId <= 0 ||
        !Number.isInteger(termsVer) ||
        termsVer <= 0 ||
        !Number.isInteger(privacyId) ||
        privacyId <= 0 ||
        !Number.isInteger(privacyVer) ||
        privacyVer <= 0
      ) {
        res.status(400).json({
          success: false,
          message: "Vendor details and both accepted policy versions are required.",
        });
        return;
      }

      if (
        partner_id != null &&
        (typeof partner_id !== "string" &&
          typeof partner_id !== "number")
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid vendor ID.",
        });
        return;
      }

      const vendorId =
        partner_id == null ? null : String(partner_id).trim();

      if (vendorId !== null && vendorId.length > 255) {
        res.status(400).json({
          success: false,
          message: "Vendor ID is too long.",
        });
        return;
      }

      const vendorName = partner_name.trim();
      const vendorEmail =
        typeof email === "string" ? email.trim() || null : null;
      const vendorPhone =
        typeof phone === "string" ? phone.trim() || null : null;

      await client.query("BEGIN");

      // Verify that both documents are the currently published
      // Vendor policies and that the submitted versions match.
      const policiesResult = await client.query(
        `SELECT
          d.id AS document_id,
          d.document_type,
          d.current_version,
          v.version_number,
          v.title,
          v.published_at
        FROM policy_documents d
        INNER JOIN policy_document_versions v
          ON v.policy_document_id = d.id
          AND v.version_number = d.current_version
        WHERE d.partner_type = 'Vendor'
          AND d.status = 'Published'
          AND (
            (d.id = $1 AND d.document_type = 'Terms & Conditions'
              AND v.version_number = $2)
            OR
            (d.id = $3 AND d.document_type = 'Privacy Policy'
              AND v.version_number = $4)
          )`,
        [termsId, termsVer, privacyId, privacyVer]
      );

      const termsPolicy = policiesResult.rows.find(
        (policy: any) =>
          Number(policy.document_id) === termsId &&
          policy.document_type === "Terms & Conditions" &&
          Number(policy.version_number) === termsVer
      );

      const privacyPolicy = policiesResult.rows.find(
        (policy: any) =>
          Number(policy.document_id) === privacyId &&
          policy.document_type === "Privacy Policy" &&
          Number(policy.version_number) === privacyVer
      );

      if (!termsPolicy || !privacyPolicy) {
        await client.query("ROLLBACK");

        res.status(409).json({
          success: false,
          message:
            "The accepted policy versions are no longer current. Please reload the registration page and review the latest documents.",
        });
        return;
      }

      const acceptedAt = new Date().toISOString();

      const acceptedPolicies = [
        {
          policy: termsPolicy,
          recordType: "Terms & Conditions Accepted",
        },
        {
          policy: privacyPolicy,
          recordType: "Privacy Policy Accepted",
        },
      ];

      const savedRecords = [];

      for (const item of acceptedPolicies) {
        const policy = item.policy;

        const detail = JSON.stringify({
          document_title: policy.title,
          document_id: Number(policy.document_id),
          version_number: Number(policy.version_number),
          published_at: policy.published_at,
          accepted_at: acceptedAt,
          acceptance_method: "Vendor registration",
        });

        const documentNumber =
          `Document ID: ${policy.document_id} | Version: ${policy.version_number}`;

        const result = await client.query(
          `INSERT INTO compliance_records (
            partner_type,
            partner_id,
            partner_name,
            email,
            phone,
            record_type,
            document_number,
            document_url,
            detail,
            admin_notes,
            review_status,
            created_at,
            updated_at
          )
          VALUES (
            'Vendor',
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            NULL,
            $7,
            NULL,
            'Pending',
            NOW(),
            NOW()
          )
          RETURNING *`,
          [
            vendorId,
            vendorName,
            vendorEmail,
            vendorPhone,
            item.recordType,
            documentNumber,
            detail,
          ]
        );

        savedRecords.push(result.rows[0]);
      }

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Vendor policy acceptance recorded successfully.",
        acceptedAt,
        records: savedRecords,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Vendor policy acceptance error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Unable to record vendor policy acceptance.",
      });
    } finally {
      client.release();
    }
  }
);


export default router;
