import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: "User",   required: true, index: true },
    review:   { type: mongoose.Schema.Types.ObjectId, ref: "Review", required: true },

    label:      { type: String, enum: ["fake", "genuine"], required: true },
    confidence: { type: Number, required: true }, // float 0-1; confidence in the predicted label
    humanScore: { type: Number, required: true }, // P(genuine) * 100 — drives the UI gauge
    riskLevel:  { type: String, enum: ["low", "medium", "high"], required: true },

    // v2: unified multilingual signal list (structural + lexicon flags)
    signals:          { type: [String], default: [] },
    detectedLanguage: { type: String, default: "en" }, // ISO 639-1 code from langdetect

    // v1 legacy fields — kept so existing DB documents don't break
    fakeSignals:    { type: [String], default: undefined },
    genuineSignals: { type: [String], default: undefined },

    wordCount:    { type: Number },
    modelVersion: { type: String, default: "v2.0-char-ngram-multilingual" },
  },
  { timestamps: true }
);

predictionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Prediction", predictionSchema);
