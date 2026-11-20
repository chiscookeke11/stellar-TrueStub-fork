import express from "express";
import request from "supertest";

jest.mock("../services/refund.service", () => ({
  refundService: { getPendingCount: jest.fn().mockResolvedValue(3) },
}));
jest.mock("../services/ownership-transfer.service", () => ({
  ownershipTransferService: { getPendingCount: jest.fn().mockResolvedValue(4) },
}));
jest.mock("../services/dispute.service", () => ({
  disputeService: { getOpenCount: jest.fn().mockResolvedValue(2) },
}));

import { adminRouter } from "./admin";

describe("GET /api/admin/store-status", () => {
  it("returns only the current financial operation counts", async () => {
    const app = express();
    app.use("/api/admin", adminRouter);

    const response = await request(app).get("/api/admin/store-status");

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual({
      openDisputes: 2,
      pendingRefunds: 3,
      pendingTransfers: 4,
    });
    expect(response.body.observedAt).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty("stores");
    expect(response.body).not.toHaveProperty("records");
  });
});
