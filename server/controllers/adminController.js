import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import ModelLog from "../models/ModelLog.js";
import { mlMetrics, mlRetrain } from "../utils/mlApiClient.js";

// @route GET /api/admin/users
export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200);
  res.json({ users: users.map((u) => u.toSafeObject()) });
});

// @route GET /api/admin/model-performance
export const getModelPerformance = asyncHandler(async (req, res) => {
  const metrics = await mlMetrics();
  res.json(metrics);
});

// @route POST /api/admin/retrain
export const retrainModel = asyncHandler(async (req, res) => {
  try {
    const result = await mlRetrain();
    await ModelLog.create({
      triggeredBy: req.user._id,
      event: "retrain",
      status: "success",
      metrics: result.metrics,
    });
    res.json(result);
  } catch (err) {
    await ModelLog.create({
      triggeredBy: req.user._id,
      event: "retrain",
      status: "failed",
      errorMessage: err.message,
    });
    res.status(502);
    throw new Error("Retraining failed. Check server logs for details.");
  }
});

// @route GET /api/admin/logs
export const getLogs = asyncHandler(async (req, res) => {
  const logs = await ModelLog.find()
    .populate("triggeredBy", "name email")
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ logs });
});
