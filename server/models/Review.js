import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 },
    platform: {
      type: String,
      enum: ["amazon", "yelp", "google_maps", "manual", "csv_upload"],
      default: "manual",
    },
    source: { type: String, enum: ["single", "batch"], default: "single" },
    batchId: { type: String, index: true }, // groups rows from one CSV upload
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);
