import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    review: { type: mongoose.Schema.Types.ObjectId, ref: "Review", required: true },
    label: { type: String, enum: ["fake", "genuine"], required: true },
    confidence: { type: Number, required: true }, // confidence in predicted label, 0-100
    humanScore: { type: Number, required: true }, // P(genuine) * 100, drives the UI gauge
    riskLevel: { type: String, enum: ["low", "medium", "high"], required: true },
    fakeSignals: [{ type: String }],
    genuineSignals: [{ type: String }],
    wordCount: { type: Number },
    modelVersion: { type: String, default: "v1.0-tfidf-logreg" },
  },
  { timestamps: true }
);

predictionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Prediction", predictionSchema);
