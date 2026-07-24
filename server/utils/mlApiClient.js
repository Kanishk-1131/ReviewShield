import axios from "axios";

const mlApi = axios.create({
  baseURL: process.env.ML_API_URL || "http://localhost:5001",
  timeout: 15000,
});

export const mlPredict = async (text) => {
  const { data } = await mlApi.post("/predict", { text });
  return data;
};

export const mlPredictBatch = async (reviews) => {
  const { data } = await mlApi.post("/predict/batch", { reviews });
  return data;
};

export const mlHealth = async () => {
  const { data } = await mlApi.get("/health");
  return data;
};

export const mlMetrics = async () => {
  const { data } = await mlApi.get("/metrics");
  return data;
};

export const mlRetrain = async () => {
  const { data } = await mlApi.post("/retrain");
  return data;
};

export default mlApi;
