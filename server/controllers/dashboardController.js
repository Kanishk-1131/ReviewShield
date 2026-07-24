import asyncHandler from "express-async-handler";
import Prediction from "../models/Prediction.js";

// @route GET /api/dashboard
export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [totalAnalyzed, fakeDetected, recent, avgAgg] = await Promise.all([
    Prediction.countDocuments({ user: userId }),
    Prediction.countDocuments({ user: userId, label: "fake" }),
    Prediction.find({ user: userId })
      .populate("review", "text platform")
      .sort({ createdAt: -1 })
      .limit(5),
    Prediction.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, avgConfidence: { $avg: "$confidence" } } },
    ]),
  ]);

  res.json({
    totalAnalyzed,
    fakeDetected,
    genuineDetected: totalAnalyzed - fakeDetected,
    fakeRate: totalAnalyzed ? Math.round((fakeDetected / totalAnalyzed) * 1000) / 10 : 0,
    avgConfidence: avgAgg[0] ? Math.round(avgAgg[0].avgConfidence * 10) / 10 : 0,
    recent,
  });
});
