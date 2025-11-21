import { CpuLogEntry } from '../types';

export const parseLogData = (input: string): CpuLogEntry[] => {
  const lines = input.trim().split('\n');
  const data: CpuLogEntry[] = [];

  for (const line of lines) {
    try {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      const entry = JSON.parse(cleanLine);
      
      // Basic validation
      if (typeof entry.cpu_user_percent === 'number' && typeof entry.cpu_sys_percent === 'number') {
         data.push({
            timestamp: entry.timestamp || new Date().toISOString(),
            pid: entry.pid || 0,
            cpu_user_percent: parseFloat(entry.cpu_user_percent.toFixed(2)),
            cpu_sys_percent: parseFloat(entry.cpu_sys_percent.toFixed(2)),
            memory_percent: entry.memory_percent ? parseFloat(entry.memory_percent.toFixed(2)) : undefined,
            command: entry.command
         });
      }
    } catch (e) {
      console.warn("Skipping invalid log line:", line);
    }
  }
  return data;
};

export const generateMockData = (): CpuLogEntry[] => {
  const data: CpuLogEntry[] = [];
  const now = new Date();
  for (let i = 0; i < 60; i++) {
    const time = new Date(now.getTime() - (60 - i) * 1000);
    // Simulate a spike
    const isSpike = i > 40 && i < 50;
    const baseUser = isSpike ? 60 : 10;
    const baseSys = isSpike ? 20 : 2;
    
    data.push({
      timestamp: time.toISOString(),
      pid: 1234,
      cpu_user_percent: Math.min(100, baseUser + Math.random() * 10),
      cpu_sys_percent: Math.min(100, baseSys + Math.random() * 5),
      memory_percent: 45 + Math.random(),
      command: 'python3 worker.py'
    });
  }
  return data;
};