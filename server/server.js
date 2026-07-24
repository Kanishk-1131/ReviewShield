import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import predictRoutes from "./routes/predictRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { mlHealth } from "./utils/mlApiClient.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use("/api", apiLimiter);

app.get("/api/health", async (req, res) => {
  const ml = await mlHealth().catch(() => ({ status: "unreachable" }));
  res.json({ status: "ok", service: "reviewshield-api", mlApi: ml });
});

app.use("/api/auth", authRoutes);
app.use("/api", predictRoutes); // /api/predict, /api/upload
app.use("/api", historyRoutes); // /api/history
app.use("/api", dashboardRoutes); // /api/dashboard
app.use("/api", analyticsRoutes); // /api/analytics
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`ReviewShield API running on port ${PORT}`));
};

start();
