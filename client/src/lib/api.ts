import axios from "axios";
import type {
  AnalyticsData,
  DashboardStats,
  HistoryItem,
  PredictionResult,
  UploadReportResult,
  User,
} from "../types";

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("reviewshield_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("reviewshield_token");
      localStorage.removeItem("reviewshield_user");
    }
    return Promise.reject(err);
  }
);

export const getApiErrorMessage = (err: unknown, fallback = "Something went wrong.") => {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || fallback;
  }
  return fallback;
};

// ---- Auth ----
export const registerRequest = (name: string, email: string, password: string) =>
  api.post<{ user: User; token: string }>("/auth/register", { name, email, password });

export const loginRequest = (email: string, password: string) =>
  api.post<{ user: User; token: string }>("/auth/login", { email, password });

export const meRequest = () => api.get<{ user: User }>("/auth/me");

// ---- Predictions ----
export const analyzeReview = (text: string, rating?: number, platform?: string) =>
  api.post<PredictionResult>("/predict", { text, rating, platform });

export const uploadCsvFile = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<UploadReportResult>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ---- History / Dashboard / Analytics ----
export const getHistory = (page = 1, limit = 20, label?: "fake" | "genuine") =>
  api.get<{ items: HistoryItem[]; page: number; totalPages: number; total: number }>("/history", {
    params: { page, limit, label },
  });

export const getDashboard = () => api.get<DashboardStats>("/dashboard");

export const getAnalytics = (days = 30) =>
  api.get<AnalyticsData>("/analytics", { params: { days } });
