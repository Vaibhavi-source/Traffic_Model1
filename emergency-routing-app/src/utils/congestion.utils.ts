import type { CongestionLevel, AlertLevel } from '@/types';

export function getCongestionLevel(score: number): CongestionLevel {
  if (score < 0.3) return 'low';
  if (score <= 0.6) return 'moderate';
  return 'high';
}

export function getCongestionColor(score: number): string {
  const level = getCongestionLevel(score);
  if (level === 'low') return '#00C851';
  if (level === 'moderate') return '#FF8800';
  return '#FF4444';
}

export function getCongestionLabel(score: number): string {
  const level = getCongestionLevel(score);
  if (level === 'low') return 'Clear';
  if (level === 'moderate') return 'Moderate Traffic';
  return 'Heavy Congestion';
}

export function getCongestionMessage(score: number): string {
  const level = getCongestionLevel(score);
  if (level === 'low') return 'Route is clear. Safe to proceed.';
  if (level === 'moderate') return 'Moderate traffic ahead. Caution advised.';
  return 'Heavy congestion detected. Consider alternate route.';
}

export function getAlertLevel(score: number): AlertLevel {
  if (score < 0.3) return 'clear';
  if (score <= 0.6) return 'moderate';
  return 'high';
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatUncertainty(val: number): string {
  return `±${val.toFixed(2)}`;
}

export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}
