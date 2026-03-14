// ─── FILE: src/types/index.ts ───

export interface PredictionResponse {
  city: string;
  timestamp: string;
  congestion_t5: number;
  congestion_t10: number;
  congestion_t20: number;
  congestion_t30: number;
  uncertainty_t5: number;
  uncertainty_t10: number;
  uncertainty_t20: number;
  uncertainty_t30: number;
  latency_ms: number;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  cities_available: string[];
  uptime_seconds: number;
}

export interface ModelInfoResponse {
  model_name: string;
  lstm_hidden_size: number;
  gcn_hidden_dim: number;
  num_prediction_horizons: number;
  checkpoint_path: string;
  parameter_count: number;
}

export interface CityConfig {
  name: string;
  lat: number;
  lng: number;
}

export interface DispatchLogEntry {
  id: string;
  timestamp: string;
  city: string;
  congestionLevel: CongestionLevel;
  score: number;
  message: string;
}

export type CongestionLevel = 'low' | 'moderate' | 'high';
export type AlertLevel = 'clear' | 'moderate' | 'high';

export interface AppState {
  selectedCity: CityConfig | null;
  predictions: Record<string, PredictionResponse>;
  health: HealthResponse | null;
  modelInfo: ModelInfoResponse | null;
  isLoading: boolean;
  lastUpdated: string | null;
  error: string | null;
  dispatchLog: DispatchLogEntry[];
  autoRefresh: boolean;
}
