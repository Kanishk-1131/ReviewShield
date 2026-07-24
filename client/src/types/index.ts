export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: "free" | "enterprise";
  createdAt: string;
}

export interface PredictionResult {
  reviewId: string;
  predictionId: string;
  label: "fake" | "genuine";
  is_fake: boolean;
  confidence: number;
  human_score: number;
  risk_level: "low" | "medium" | "high";
  fake_signals: string[];
  genuine_signals: string[];
  word_count: number;
  createdAt: string;
  note?: string;
}

export interface HistoryItem {
  _id: string;
  label: "fake" | "genuine";
  confidence: number;
  humanScore: number;
  riskLevel: "low" | "medium" | "high";
  wordCount: number;
  createdAt: string;
  review: {
    _id: string;
    text: string;
    rating?: number;
    platform: string;
    createdAt: string;
  };
}

export interface DashboardStats {
  totalAnalyzed: number;
  fakeDetected: number;
  genuineDetected: number;
  fakeRate: number;
  avgConfidence: number;
  recent: HistoryItem[];
}

export interface AnalyticsData {
  reviewsAnalyzed: number;
  fakeDetected: number;
  fakeDetectedPct: number;
  avgConfidence: number;
  modelAccuracy: number | null;
  analysisTrend: { date: string; real: number; suspicious: number }[];
  platformDistribution: { platform: string; count: number }[];
}

export interface UploadReportResult {
  reportId: string;
  batchId: string;
  totalReviews: number;
  fakeCount: number;
  genuineCount: number;
  avgConfidence: number;
  skipped: number;
}
