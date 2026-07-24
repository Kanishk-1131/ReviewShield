import mongoose from "mongoose";

const modelLogSchema = new mongoose.Schema(
  {
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    event: { type: String, enum: ["train", "retrain"], default: "retrain" },
    status: { type: String, enum: ["success", "failed"], required: true },
    metrics: { type: mongoose.Schema.Types.Mixed },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("ModelLog", modelLogSchema);
