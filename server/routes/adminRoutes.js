import express from "express";
import {
  listUsers,
  getModelPerformance,
  retrainModel,
  getLogs,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, adminOnly);
router.get("/users", listUsers);
router.get("/model-performance", getModelPerformance);
router.post("/retrain", retrainModel);
router.get("/logs", getLogs);

export default router;
