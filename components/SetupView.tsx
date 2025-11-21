import React, { useState } from 'react';
import { CpuLogEntry } from '../types';
import { parseLogData, generateMockData } from '../utils/parser';

interface SetupViewProps {
  onDataLoaded: (data: CpuLogEntry[]) => void;
}

const PYTHON_SCRIPT = `
import time
import sys
import json
import os

def get_total_memory():
    try:
        with open('/proc/meminfo', 'r') as f:
            for line in f:
                if line.startswith('MemTotal:'):
                    return int(line.split()[1]) * 1024 # Convert to bytes
    except:
        return None

def get_process_stats(pid):
    try:
        with open(f'/proc/{pid}/stat', 'r') as f:
            content = f.read()
            # Handle process names with spaces/parentheses
            r_par = content.rfind(')')
            if r_par == -1:
                return None, None, None
                
            # Fields after process name. 
            # Field indices in 'fields' list (0-based):
            # 0: state (field 3 in man page)
            # ...
            # 11: utime (field 14)
            # 12: stime (field 15)
            # ...
            # 21: rss (field 24)
            fields = content[r_par+2:].split()
            
            utime = int(fields[11])
            stime = int(fields[12])
            rss_pages = int(fields[21])
            
            return utime, stime, rss_pages
    except Exception:
        return None, None, None

def monitor(pid, interval=1.0):
    # Get HZ (clock ticks per second)
    try:
        clk_tck = os.sysconf(os.sysconf_names['SC_CLK_TCK'])
    except:
        clk_tck = 100
        
    # Get Page Size
    try:
        page_size = os.sysconf('SC_PAGE_SIZE')
    except:
        page_size = 4096
        
    total_mem = get_total_memory() or 1 # Prevent division by zero

    last_utime, last_stime, _ = get_process_stats(pid)
    if last_utime is None:
        print(json.dumps({"error": "Process not found"}))
        return

    print(f"Monitoring PID {pid}... Outputting JSON lines.")
    
    while True:
        time.sleep(interval)
        curr_utime, curr_stime, curr_rss = get_process_stats(pid)
        
        if curr_utime is None:
            break
            
        # Calculate delta ticks
        u_delta = curr_utime - last_utime
        s_delta = curr_stime - last_stime
        
        # Convert to percentage of one CPU core
        u_percent = (u_delta / clk_tck) / interval * 100
        s_percent = (s_delta / clk_tck) / interval * 100
        
        # Calculate memory percentage
        mem_percent = ((curr_rss * page_size) / total_mem) * 100
        
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "pid": pid,
            "cpu_user_percent": round(u_percent, 2),
            "cpu_sys_percent": round(s_percent, 2),
            "memory_percent": round(mem_percent, 2)
        }
        
        print(json.dumps(log_entry), flush=True)
        
        last_utime = curr_utime
        last_stime = curr_stime

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 monitor.py <PID>")
        sys.exit(1)
    
    monitor(int(sys.argv[1]))
`;

const SetupView: React.FC<SetupViewProps> = ({ onDataLoaded }) => {
  const [logInput, setLogInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(PYTHON_SCRIPT.trim());
    alert("Script copied to clipboard!");
  };

  const handleParse = () => {
    setError(null);
    if (!logInput.trim()) {
      setError("Please paste some log data first.");
      return;
    }
    const data = parseLogData(logInput);
    if (data.length === 0) {
      setError("Could not parse any valid JSON lines. Check the format.");
      return;
    }
    onDataLoaded(data);
  };

  const loadDemo = () => {
    const data = generateMockData();
    onDataLoaded(data);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          Linux Process Monitor
        </h1>
        <p className="text-slate-400 text-lg">
          Generate, capture, and visualize CPU performance data.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Step 1: The Script */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col shadow-lg">
          <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
            <h2 className="font-semibold text-blue-400 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs">1</span>
              Capture Data
            </h2>
            <button 
              onClick={handleCopyScript}
              className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1 rounded transition-colors"
            >
              Copy Python Script
            </button>
          </div>
          <div className="p-4 flex-1 bg-slate-950 relative group">
            <pre className="text-xs text-emerald-300 font-mono overflow-x-auto p-2 h-64 scrollbar-hide">
              {PYTHON_SCRIPT.trim()}
            </pre>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80 pointer-events-none" />
          </div>
          <div className="p-4 text-sm text-slate-400 bg-slate-900/30">
            <p>Run locally: <code className="bg-slate-700 px-1 rounded text-slate-200">python3 monitor.py &lt;PID&gt;</code></p>
          </div>
        </div>

        {/* Step 2: Import */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col shadow-lg">
          <div className="p-4 bg-slate-900/50 border-b border-slate-700">
            <h2 className="font-semibold text-emerald-400 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">2</span>
              Analyze Logs
            </h2>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4">
            <textarea
              className="w-full flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              placeholder={`Paste JSON output here...\n{"timestamp": "...", "pid": 123, "cpu_user_percent": 12.5, "cpu_sys_percent": 1.2, "memory_percent": 0.5}\n...`}
              value={logInput}
              onChange={(e) => setLogInput(e.target.value)}
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleParse}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded-lg font-medium transition-all shadow-lg shadow-blue-900/20"
              >
                Visualize Data
              </button>
              <button
                onClick={loadDemo}
                className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Load Demo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupView;