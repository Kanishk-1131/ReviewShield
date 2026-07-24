import express from "express";
import { predictReview, uploadCsv } from "../controllers/predictController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.post("/predict", protect, predictReview);
router.post("/upload", protect, upload.single("file"), uploadCsv);

export default router;
