export interface CpuLogEntry {
  timestamp: string; // ISO string or HH:mm:ss
  pid: number;
  cpu_user_percent: number;
  cpu_sys_percent: number;
  memory_percent?: number;
  command?: string;
}

export enum AppState {
  SETUP = 'SETUP',
  DASHBOARD = 'DASHBOARD',
}

export interface AnalysisResult {
  summary: string;
  recommendations: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}
