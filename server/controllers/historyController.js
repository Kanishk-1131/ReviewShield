import asyncHandler from "express-async-handler";
import Prediction from "../models/Prediction.js";

// @route GET /api/history?page=1&limit=20&label=fake
export const getHistory = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const filter = { user: req.user._id };
  if (req.query.label === "fake" || req.query.label === "genuine") {
    filter.label = req.query.label;
  }

  const [items, total] = await Promise.all([
    Prediction.find(filter)
      .populate("review", "text rating platform createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Prediction.countDocuments(filter),
  ]);

  res.json({
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});
