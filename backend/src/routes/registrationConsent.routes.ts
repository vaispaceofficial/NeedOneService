import { Router, Request, Response } from "express";
import { pool } from "../config/database.js";

const router = Router();

const requiredDocumentTypes = [
  "Terms & Conditions",
  "Privacy Policy",
] as const;

router.post(
  "/vendor",
  async (req: Request, res: Response) => {
    const {
      vendor_id,
      full_name,
      email,
      phone,
      business_name,
      terms_accepted,
      privacy_accepted,
    } = req.body;

    if (
      typeof vendor_id !== "string" ||
      !vendor_id.trim() ||
      typeof full_name !== "string" ||
      !full_name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof business_name !== "string" ||
      !business_name.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Vendor registration details are incomplete.",
      });
      return;
    }

    if (
      terms_accepted !== true ||
      privacy_accepted !== true
    ) {
      res.status(400).json({
        success: false,
        message: "Both legal consent statements must be accepted.",
      });
      return;
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      // Always retrieve the currently published policy versions
      // from the database. Do not trust versions sent by the browser.
      const policiesResult = await client.query(
        `SELECT
          d.id AS document_id,
          d.partner_type,
          d.document_type,
          v.title,
          v.version_number,
          v.published_at
        FROM policy_documents d
        INNER JOIN policy_document_versions v
          ON v.policy_document_id = d.id
          AND v.version_number = d.current_version
        WHERE d.partner_type = $1
          AND d.current_version > 0
          AND d.document_type = ANY($2::text[])
        ORDER BY d.document_type`,
        ["Vendor", [...requiredDocumentTypes]]
      );

      const policies = policiesResult.rows;

      const termsPolicy = policies.find(
        (policy) =>
          policy.document_type === "Terms & Conditions"
      );

      const privacyPolicy = policies.find(
        (policy) =>
          policy.document_type === "Privacy Policy"
      );

      if (!termsPolicy || !privacyPolicy) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        res.status(409).json({
          success: false,
          message:
            "The latest Vendor Terms & Conditions and Privacy Policy must both be published before registration.",
        });
        return;
      }

      const acceptedPolicies = [
        termsPolicy,
        privacyPolicy,
      ];

      const insertedRecords = [];

      for (const policy of acceptedPolicies) {
        const isTerms =
          policy.document_type === "Terms & Conditions";

        const result = await client.query(
          `INSERT INTO compliance_records (
            partner_type,
            partner_id,
            partner_name,
            email,
            phone,
            record_type,
            detail,
            document_number,
            review_status,
            notes
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, 'Pending', $9
          )
          RETURNING *`,
          [
            "Vendor",
            vendor_id.trim(),
            full_name.trim(),
            email.trim().toLowerCase(),
            phone.trim(),
            isTerms
              ? "Terms & Conditions Acceptance"
              : "Privacy Policy Acceptance",
            [
              `Business: ${business_name.trim()}`,
              `Document: ${policy.title}`,
              `Document ID: ${policy.document_id}`,
              `Published version: ${policy.version_number}`,
              `Published date: ${policy.published_at}`,
            ].join(" | "),
            `Version ${policy.version_number}`,
            `Vendor explicitly accepted the published ${policy.document_type} during registration.`,
          ]
        );

        insertedRecords.push(result.rows[0]);
      }

      await client.query("COMMIT");
      transactionStarted = false;

      res.status(201).json({
        success: true,
        message:
          "Vendor legal consents recorded successfully.",
        vendorId: vendor_id,
        records: insertedRecords,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error(
        "Vendor registration consent error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to record Vendor legal consent.",
      });
    } finally {
      client.release();
    }
  }
);


router.post(
  "/professional",
  async (req: Request, res: Response) => {
    const {
      professional_id,
      full_name,
      email,
      phone,
      category,
      terms_accepted,
      privacy_accepted,
    } = req.body;

    if (
      typeof professional_id !== "string" ||
      !professional_id.trim() ||
      typeof full_name !== "string" ||
      !full_name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof category !== "string" ||
      !category.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Professional registration details are incomplete.",
      });
      return;
    }

    if (terms_accepted !== true || privacy_accepted !== true) {
      res.status(400).json({
        success: false,
        message: "Both legal consent statements must be accepted.",
      });
      return;
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const policiesResult = await client.query(
        `SELECT
          d.id AS document_id,
          d.partner_type,
          d.document_type,
          v.title,
          v.version_number,
          v.published_at
        FROM policy_documents d
        INNER JOIN policy_document_versions v
          ON v.policy_document_id = d.id
          AND v.version_number = d.current_version
        WHERE d.partner_type = $1
          AND d.current_version > 0
          AND d.document_type = ANY($2::text[])
        ORDER BY d.document_type`,
        ["Professional", [...requiredDocumentTypes]]
      );

      const policies = policiesResult.rows;

      const termsPolicy = policies.find(
        (policy) => policy.document_type === "Terms & Conditions"
      );

      const privacyPolicy = policies.find(
        (policy) => policy.document_type === "Privacy Policy"
      );

      if (!termsPolicy || !privacyPolicy) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        res.status(409).json({
          success: false,
          message:
            "The latest Professional Terms & Conditions and Privacy Policy must both be published before registration.",
        });
        return;
      }

      const insertedRecords = [];

      for (const policy of [termsPolicy, privacyPolicy]) {
        const isTerms =
          policy.document_type === "Terms & Conditions";

        const result = await client.query(
          `INSERT INTO compliance_records (
            partner_type,
            partner_id,
            partner_name,
            email,
            phone,
            record_type,
            detail,
            document_number,
            review_status,
            notes
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, 'Pending', $9
          )
          RETURNING *`,
          [
            "Professional",
            professional_id.trim(),
            full_name.trim(),
            email.trim().toLowerCase(),
            phone.trim(),
            isTerms
              ? "Terms & Conditions Acceptance"
              : "Privacy Policy Acceptance",
            [
              `Category: ${category.trim()}`,
              `Document: ${policy.title}`,
              `Document ID: ${policy.document_id}`,
              `Published version: ${policy.version_number}`,
              `Published date: ${policy.published_at}`,
            ].join(" | "),
            `Version ${policy.version_number}`,
            `Professional explicitly accepted the published ${policy.document_type} during registration.`,
          ]
        );

        insertedRecords.push(result.rows[0]);
      }

      await client.query("COMMIT");
      transactionStarted = false;

      res.status(201).json({
        success: true,
        message: "Professional legal consents recorded successfully.",
        professionalId: professional_id,
        records: insertedRecords,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error("Professional registration consent error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to record Professional legal consent.",
      });
    } finally {
      client.release();
    }
  }
);

export default router;