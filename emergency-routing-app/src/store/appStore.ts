import { create } from 'zustand';
import type {
  AppState,
  CityConfig,
  PredictionResponse,
  HealthResponse,
  ModelInfoResponse,
  DispatchLogEntry,
} from '@/types';
import { getCongestionLevel, getCongestionMessage } from '@/utils/congestion.utils';

interface AppActions {
  setSelectedCity: (city: CityConfig) => void;
  setPrediction: (city: string, data: PredictionResponse) => void;
  setBatchPredictions: (data: PredictionResponse[]) => void;
  setHealth: (data: HealthResponse) => void;
  setModelInfo: (data: ModelInfoResponse) => void;
  setLoading: (val: boolean) => void;
  setError: (msg: string | null) => void;
  clearPredictions: () => void;
  clearDispatchLog: () => void;
  setAutoRefresh: (val: boolean) => void;
}

function buildLogEntry(data: PredictionResponse): DispatchLogEntry {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    city: data.city,
    congestionLevel: getCongestionLevel(data.congestion_t5),
    score: data.congestion_t5,
    message: getCongestionMessage(data.congestion_t5),
  };
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  selectedCity: null,
  predictions: {},
  health: null,
  modelInfo: null,
  isLoading: false,
  lastUpdated: null,
  error: null,
  dispatchLog: [],
  autoRefresh: false,

  setSelectedCity: (city: CityConfig): void =>
    set({ selectedCity: city }),

  setPrediction: (city: string, data: PredictionResponse): void =>
    set((state) => {
      const entry = buildLogEntry(data);
      const newLog = [entry, ...state.dispatchLog].slice(0, 100);
      return {
        predictions: { ...state.predictions, [city]: data },
        dispatchLog: newLog,
      };
    }),

  setBatchPredictions: (data: PredictionResponse[]): void =>
    set((state) => {
      const newPreds = { ...state.predictions };
      const entries: DispatchLogEntry[] = [];
      data.forEach((d) => {
        newPreds[d.city] = d;
        entries.push(buildLogEntry(d));
      });
      const newLog = [...entries, ...state.dispatchLog].slice(0, 100);
      return { predictions: newPreds, dispatchLog: newLog };
    }),

  setHealth: (data: HealthResponse): void =>
    set({ health: data }),

  setModelInfo: (data: ModelInfoResponse): void =>
    set({ modelInfo: data }),

  setLoading: (val: boolean): void =>
    set({ isLoading: val }),

  setError: (msg: string | null): void =>
    set({ error: msg }),

  clearPredictions: (): void =>
    set({ predictions: {} }),

  clearDispatchLog: (): void =>
    set({ dispatchLog: [] }),

  setAutoRefresh: (val: boolean): void =>
    set({ autoRefresh: val }),
}));

export default useAppStore;
