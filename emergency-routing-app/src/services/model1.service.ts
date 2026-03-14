import axios from 'axios';
import { API_BASE_URL } from '@/config/api.config';
import type { HealthResponse, PredictionResponse, ModelInfoResponse } from '@/types';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export async function checkHealth(): Promise<HealthResponse> {
  try {
    const resp = await client.get<HealthResponse>('/health');
    return resp.data;
  } catch (err) {
    console.error('checkHealth failed:', err);
    throw err;
  }
}

export async function predictCity(cityName: string): Promise<PredictionResponse> {
  try {
    const resp = await client.post<PredictionResponse>('/predict', {
      city_name: cityName,
    });
    return resp.data;
  } catch (err) {
    console.error('predictCity failed:', err);
    throw err;
  }
}

export async function predictBatch(cityNames: string[]): Promise<PredictionResponse[]> {
  try {
    const resp = await client.post<PredictionResponse[]>('/predict/batch', {
      city_names: cityNames,
    });
    return resp.data.filter(
      (item: PredictionResponse) => item.congestion_t5 !== undefined,
    );
  } catch (err) {
    console.error('predictBatch failed:', err);
    throw err;
  }
}

export async function getModelInfo(): Promise<ModelInfoResponse> {
  try {
    const resp = await client.get<ModelInfoResponse>('/model/info');
    return resp.data;
  } catch (err) {
    console.error('getModelInfo failed:', err);
    throw err;
  }
}
