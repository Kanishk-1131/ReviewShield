import asyncHandler from "express-async-handler";
import Prediction from "../models/Prediction.js";
import Review from "../models/Review.js";
import { mlMetrics } from "../utils/mlApiClient.js";

// @route GET /api/analytics?days=30
export const getAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const days = Math.min(parseInt(req.query.days) || 30, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [summary, trend, platforms, modelMetrics] = await Promise.all([
    Prediction.aggregate([
      { $match: { user: userId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          reviewsAnalyzed: { $sum: 1 },
          fakeDetected: { $sum: { $cond: [{ $eq: ["$label", "fake"] }, 1, 0] } },
          avgConfidence: { $avg: "$confidence" },
        },
      },
    ]),
    Prediction.aggregate([
      { $match: { user: userId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          real: { $sum: { $cond: [{ $eq: ["$label", "genuine"] }, 1, 0] } },
          suspicious: { $sum: { $cond: [{ $eq: ["$label", "fake"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Review.aggregate([
      { $match: { user: userId, createdAt: { $gte: since } } },
      { $group: { _id: "$platform", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    mlMetrics().catch(() => null), // model may not be trained/reachable yet
  ]);

  const s = summary[0] || { reviewsAnalyzed: 0, fakeDetected: 0, avgConfidence: 0 };

  res.json({
    reviewsAnalyzed: s.reviewsAnalyzed,
    fakeDetected: s.fakeDetected,
    fakeDetectedPct: s.reviewsAnalyzed
      ? Math.round((s.fakeDetected / s.reviewsAnalyzed) * 1000) / 10
      : 0,
    avgConfidence: s.reviewsAnalyzed ? Math.round(s.avgConfidence * 10) / 10 : 0,
    modelAccuracy: modelMetrics ? Math.round(modelMetrics.accuracy * 1000) / 10 : null,
    analysisTrend: trend.map((t) => ({ date: t._id, real: t.real, suspicious: t.suspicious })),
    platformDistribution: platforms.map((p) => ({ platform: p._id, count: p.count })),
  });
});
