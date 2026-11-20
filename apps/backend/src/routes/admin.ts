import { Router, type Request, type Response } from "express";
import { refundService } from "../services/refund.service";
import { ownershipTransferService } from "../services/ownership-transfer.service";
import { disputeService } from "../services/dispute.service";

export const adminRouter = Router();

/**
 * GET /api/admin/store-status
 *
 * Operational snapshot of the process-local financial stores. This endpoint
 * is mounted behind requireAdmin in index.ts and intentionally reports counts
 * only; it never returns stored records or implementation details.
 */
adminRouter.get("/store-status", async (_req: Request, res: Response) => {
  const [openDisputes, pendingRefunds, pendingTransfers] = await Promise.all([
    disputeService.getOpenCount(),
    refundService.getPendingCount(),
    ownershipTransferService.getPendingCount(),
  ]);

  return res.json({
    counts: {
      openDisputes,
      pendingRefunds,
      pendingTransfers,
    },
    observedAt: new Date().toISOString(),
  });
});
