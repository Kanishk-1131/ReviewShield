import asyncHandler from "express-async-handler";
import { randomUUID } from "crypto";
import Review from "../models/Review.js";
import Prediction from "../models/Prediction.js";
import Report from "../models/Report.js";
import { mlPredict, mlPredictBatch } from "../utils/mlApiClient.js";
import { parseReviewsCsv } from "../utils/csvParser.js";

// @route POST /api/predict
// body: { text, rating?, platform? }
export const predictReview = asyncHandler(async (req, res) => {
  const { text, rating, platform } = req.body;

  if (!text || !text.trim()) {
    res.status(400);
    throw new Error("Review text is required.");
  }

  const mlResult = await mlPredict(text.trim());

  const review = await Review.create({
    user: req.user._id,
    text: text.trim(),
    rating,
    platform: platform || "manual",
    source: "single",
  });

  const prediction = await Prediction.create({
    user: req.user._id,
    review: review._id,
    label: mlResult.label,
    confidence: mlResult.confidence,
    humanScore: mlResult.human_score,
    riskLevel: mlResult.risk_level,
    fakeSignals: mlResult.fake_signals,
    genuineSignals: mlResult.genuine_signals,
    wordCount: mlResult.word_count,
  });

  res.status(201).json({
    reviewId: review._id,
    predictionId: prediction._id,
    ...mlResult,
    createdAt: prediction.createdAt,
  });
});

// @route POST /api/upload  (multipart/form-data, field name: "file")
export const uploadCsv = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("A .csv file is required (field name 'file').");
  }

  const texts = parseReviewsCsv(req.file.buffer);
  if (texts.length === 0) {
    res.status(400);
    throw new Error("No review text found in the uploaded CSV.");
  }

  const capped = texts.slice(0, 500); // matches ML API's MAX_BATCH
  const batchResult = await mlPredictBatch(capped);
  const batchId = randomUUID();

  const reviewDocs = await Review.insertMany(
    capped.map((text) => ({
      user: req.user._id,
      text,
      platform: "csv_upload",
      source: "batch",
      batchId,
    }))
  );

  const predictionDocs = batchResult.results.map((r, i) => ({
    user: req.user._id,
    review: reviewDocs[i]._id,
    label: r.label,
    confidence: r.confidence,
    humanScore: r.human_score,
    riskLevel: r.risk_level,
    fakeSignals: r.fake_signals,
    genuineSignals: r.genuine_signals,
    wordCount: r.word_count,
  }));
  await Prediction.insertMany(predictionDocs);

  const avgConfidence =
    predictionDocs.reduce((sum, p) => sum + p.confidence, 0) / predictionDocs.length;

  const report = await Report.create({
    user: req.user._id,
    batchId,
    fileName: req.file.originalname,
    totalReviews: capped.length,
    fakeCount: batchResult.fake_count,
    genuineCount: batchResult.genuine_count,
    avgConfidence: Math.round(avgConfidence * 10) / 10,
  });

  res.status(201).json({
    reportId: report._id,
    batchId,
    totalReviews: capped.length,
    fakeCount: batchResult.fake_count,
    genuineCount: batchResult.genuine_count,
    avgConfidence: report.avgConfidence,
    skipped: texts.length - capped.length,
  });
});
