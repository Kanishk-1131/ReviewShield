import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    batchId: { type: String, required: true },
    fileName: { type: String },
    totalReviews: { type: Number, required: true },
    fakeCount: { type: Number, required: true },
    genuineCount: { type: Number, required: true },
    avgConfidence: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
