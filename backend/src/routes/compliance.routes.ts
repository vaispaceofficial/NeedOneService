
import { Router, Request, Response } from "express";
import { pool } from "../config/database.js";

const router = Router();

const validStatuses = ["Pending", "Reviewed", "Rejected"];

const getRecordPayload = (body: any) => ({
    partner_type: body.partner_type,
    partner_id: body.partner_id || null,
    partner_name: body.partner_name,
    record_type: body.record_type,
    detail: body.detail || null,
    document_number: body.document_number || null,
    document_url: body.document_url || null,
    admin_notes: body.admin_notes || null,
    review_status: body.review_status || "Pending",
    reviewed_by: body.reviewed_by || null,
});

// GET ALL COMPLIANCE RECORDS
router.get("/", async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT *
      FROM compliance_records
      ORDER BY created_at DESC
    `);

        res.json({
            success: true,
            records: result.rows,
        });
    } catch (error) {
        console.error("Fetch compliance records error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch compliance records",
        });
    }
});

// GET COMPLIANCE STATISTICS
router.get("/stats", async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE review_status = 'Reviewed'
        ) AS reviewed,
        COUNT(*) FILTER (
          WHERE review_status = 'Pending'
        ) AS pending,
        COUNT(*) FILTER (
          WHERE review_status = 'Rejected'
        ) AS rejected
      FROM compliance_records
    `);

        res.json({
            success: true,
            stats: result.rows[0],
        });
    } catch (error) {
        console.error("Compliance stats error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch compliance statistics",
        });
    }
});

// ADD COMPLIANCE RECORD
router.post("/", async (req: Request, res: Response) => {
    try {
        const data = getRecordPayload(req.body);

        if (!data.partner_type || !data.partner_name || !data.record_type) {
            res.status(400).json({
                success: false,
                message: "Partner type, partner name and record type are required",
            });
            return;
        }

        if (!validStatuses.includes(data.review_status)) {
            res.status(400).json({
                success: false,
                message: "Invalid review status",
            });
            return;
        }

        const result = await pool.query(
            `INSERT INTO compliance_records (
        partner_type,
        partner_id,
        partner_name,
        record_type,
        detail,
        document_number,
        document_url,
        admin_notes,
        review_status,
        reviewed_by,
        reviewed_at
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::varchar, $10,
  CASE WHEN $9::text = 'Reviewed' THEN NOW() ELSE NULL END
)
      RETURNING *`,
            [
                data.partner_type,
                data.partner_id,
                data.partner_name,
                data.record_type,
                data.detail,
                data.document_number,
                data.document_url,
                data.admin_notes,
                data.review_status,
                data.reviewed_by,
            ]
        );

        res.status(201).json({
            success: true,
            message: "Compliance record created successfully",
            record: result.rows[0],
        });
    } catch (error) {
        console.error("Create compliance record error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create compliance record",
        });
    }
});

// UPDATE COMPLIANCE RECORD
router.put("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = getRecordPayload(req.body);

        if (!data.partner_type || !data.partner_name || !data.record_type) {
            res.status(400).json({
                success: false,
                message: "Partner type, partner name and record type are required",
            });
            return;
        }

        if (!validStatuses.includes(data.review_status)) {
            res.status(400).json({
                success: false,
                message: "Invalid review status",
            });
            return;
        }

        const result = await pool.query(
            `UPDATE compliance_records
       SET
         partner_type = $1,
         partner_id = $2,
         partner_name = $3,
         record_type = $4,
         detail = $5,
         document_number = $6,
         document_url = $7,
         admin_notes = $8,
         review_status = $9::varchar,
         reviewed_by = $10,
         reviewed_at = CASE
           WHEN $9::text = 'Reviewed' THEN COALESCE(reviewed_at, NOW())
           ELSE NULL
         END,
         updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
            [
                data.partner_type,
                data.partner_id,
                data.partner_name,
                data.record_type,
                data.detail,
                data.document_number,
                data.document_url,
                data.admin_notes,
                data.review_status,
                data.reviewed_by,
                id,
            ]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Compliance record not found",
            });
            return;
        }

        res.json({
            success: true,
            message: "Compliance record updated successfully",
            record: result.rows[0],
        });
    } catch (error) {
        console.error("Update compliance record error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update compliance record",
        });
    }
});

// UPDATE REVIEW STATUS
router.patch("/:id/status", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { review_status, reviewed_by } = req.body;

        if (!validStatuses.includes(review_status)) {
            res.status(400).json({
                success: false,
                message: "Invalid review status",
            });
            return;
        }

        const result = await pool.query(
            `UPDATE compliance_records
       SET
         review_status = $1::varchar,
         reviewed_by = $2,
         reviewed_at = CASE
           WHEN $1::text = 'Reviewed' THEN NOW()
           ELSE NULL
         END,
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
            [review_status, reviewed_by || null, id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Compliance record not found",
            });
            return;
        }

        res.json({
            success: true,
            message: "Review status updated successfully",
            record: result.rows[0],
        });
    } catch (error) {
        console.error("Update compliance status error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update review status",
        });
    }
});

// GET SINGLE COMPLIANCE RECORD
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "SELECT * FROM compliance_records WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Compliance record not found",
            });
            return;
        }

        res.json({
            success: true,
            record: result.rows[0],
        });
    } catch (error) {
        console.error("Fetch compliance record error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch compliance record",
        });
    }
});

// DELETE COMPLIANCE RECORD
router.delete("/:id", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM compliance_records WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: "Compliance record not found",
            });
            return;
        }

        res.json({
            success: true,
            message: "Compliance record deleted successfully",
            id: result.rows[0].id,
        });
    } catch (error) {
        console.error("Delete compliance record error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete compliance record",
        });
    }
});

export default router;
