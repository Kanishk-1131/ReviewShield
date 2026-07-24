import express from "express";
import { getHistory } from "../controllers/historyController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/history", protect, getHistory);

export default router;
