export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: "free" | "enterprise";
  createdAt: string;
}

export interface PredictionResult {
  reviewId:          string;
  predictionId:      string;
  label:             string;         // "Fake" | "Genuine" | "fake" | "genuine"
  is_fake:           boolean;
  confidence:        number;         // float 0–1
  human_score:       number;         // 0–100 for UI gauge
  risk_level:        "low" | "medium" | "high";
  detected_language: string;         // ISO 639-1, e.g. "en", "es", "zh-cn"
  signals:           string[];       // unified structural + lexicon flags
  word_count:        number;
  createdAt:         string;
  note?:             string;
  // v1 legacy — may be present in older cached responses
  fake_signals?:    string[];
  genuine_signals?: string[];
}

export interface HistoryItem {
  _id:              string;
  label:            string;
  confidence:       number;
  humanScore:       number;
  riskLevel:        "low" | "medium" | "high";
  wordCount:        number;
  detectedLanguage: string;    // ISO 639-1
  signals:          string[];  // may be [] for old records
  createdAt:        string;
  review: {
    _id:      string;
    text:     string;
    rating?:  number;
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
