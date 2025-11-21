import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { CpuLogEntry, AnalysisResult } from '../types';
import { analyzeCpuData } from '../services/geminiService';
import { BrainCircuit, Activity, ArrowLeft, RefreshCw, Filter, X, Save, DownloadCloud, Copy, Check, AlertTriangle, Play, Pause, Zap } from 'lucide-react';

interface DashboardProps {
  data: CpuLogEntry[];
  onReset: () => void;
}

const MAX_HISTORY = 100; // Rolling window size for real-time data

const CustomTooltip = ({ active, payload, label }: any) => {
  const [copied, setCopied] = useState<string | null>(null);

  // Reset copied state when tooltip closes or changes data
  useEffect(() => {
    if (!active) setCopied(null);
  }, [active, label]);

  if (active && payload && payload.length) {
    const data = payload[0].payload;

    const handleCopy = (e: React.MouseEvent, text: string, key: string) => {
      e.stopPropagation(); // Prevent event bubbling
      if (!text) return;
      navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    };

    return (
      <div className="bg-slate-800 border border-slate-600 p-3 rounded-lg shadow-2xl text-xs min-w-[200px] animate-in fade-in zoom-in-95 duration-100 cursor-default">
        <div className="font-medium text-slate-300 mb-2 pb-1 border-b border-slate-700 flex justify-between items-center">
          <span>{label}</span>
        </div>
        
        <div className="mb-3 bg-slate-900/50 p-2 rounded border border-slate-700/50 group/cmd relative hover:bg-slate-900 transition-colors">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Command</span>
                <button 
                    onClick={(e) => handleCopy(e, data.command || '', 'cmd')}
                    className="opacity-0 group-hover/cmd:opacity-100 text-slate-500 hover:text-white transition-all p-1 hover:bg-slate-700 rounded"
                    title="Copy Command"
                >
                    {copied === 'cmd' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
            </div>
            <span className="font-mono text-emerald-400 break-all block max-h-20 overflow-y-auto scrollbar-hide">
                {data.command || 'N/A'}
            </span>
        </div>

        <div className="space-y-1">
            {payload.map((p: any, index: number) => (
            <div 
                key={index} 
                className="flex items-center gap-2 p-1 -mx-1 rounded hover:bg-white/5 cursor-pointer group/item transition-colors select-none"
                onClick={(e) => handleCopy(e, p.value.toString(), p.name)}
                title="Click to copy value"
            >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                <span className="text-slate-300 flex-1">{p.name}:</span>
                <span className="font-mono font-medium text-white">{p.value}%</span>
                <span className="opacity-0 group-hover/item:opacity-100 text-slate-500 transition-opacity">
                    {copied === p.name ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                </span>
            </div>
            ))}
        </div>
        <div className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-500 text-center italic">
            Click values to copy
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ data: initialData, onReset }) => {
  // Local state for data to allow appending real-time updates
  const [localData, setLocalData] = useState<CpuLogEntry[]>(initialData);
  
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');
  const [hasSavedAnalysis, setHasSavedAnalysis] = useState(false);
  const [cpuThreshold, setCpuThreshold] = useState<number>(80);
  
  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for saved analysis on mount
  useEffect(() => {
    const saved = localStorage.getItem('cpu_analysis_result');
    setHasSavedAnalysis(!!saved);
  }, []);

  // Initialize filters when data loads (only once or if hard reset)
  useEffect(() => {
    if (initialData.length > 0 && !isStreaming) {
      const formatForInput = (ts: string) => {
          try {
            return ts.length >= 16 ? ts.substring(0, 16) : ts;
          } catch { return ''; }
      };
      setFilterStart(formatForInput(initialData[0].timestamp));
      setFilterEnd(formatForInput(initialData[initialData.length - 1].timestamp));
    }
  }, [initialData]); // Removed isStreaming dependency to prevent reset on toggle

  // Streaming Logic
  useEffect(() => {
    if (isStreaming) {
      // Clear any existing analysis when streaming starts as data is changing
      if (analysis) setAnalysis(null);

      streamIntervalRef.current = setInterval(() => {
        setLocalData(prevData => {
          const lastEntry = prevData[prevData.length - 1];
          const lastDate = new Date(lastEntry.timestamp);
          const newDate = new Date(lastDate.getTime() + 1000); // Add 1 second
          
          // Simulate Random Walk for realistic-looking data
          const drift = () => (Math.random() - 0.5) * 10;
          const clamp = (num: number) => Math.min(100, Math.max(0, num));
          
          const newUser = clamp(lastEntry.cpu_user_percent + drift());
          const newSys = clamp(lastEntry.cpu_sys_percent + (drift() / 2));
          const newMem = lastEntry.memory_percent 
            ? clamp(lastEntry.memory_percent + (drift() / 5)) 
            : undefined;

          const newEntry: CpuLogEntry = {
            timestamp: newDate.toISOString(),
            pid: lastEntry.pid,
            cpu_user_percent: Number(newUser.toFixed(2)),
            cpu_sys_percent: Number(newSys.toFixed(2)),
            memory_percent: newMem ? Number(newMem.toFixed(2)) : undefined,
            command: lastEntry.command
          };

          // Rolling window: Keep last MAX_HISTORY items
          const updated = [...prevData, newEntry];
          if (updated.length > MAX_HISTORY) {
            return updated.slice(updated.length - MAX_HISTORY);
          }
          return updated;
        });
      }, 1000);
    } else {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    }

    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, [isStreaming]);

  const filteredData = useMemo(() => {
    // If streaming, just show the rolling window (localData)
    if (isStreaming) return localData;

    if (!filterStart && !filterEnd) return localData;
    
    const startTs = filterStart ? new Date(filterStart).getTime() : -Infinity;
    const endTs = filterEnd ? new Date(filterEnd).getTime() : Infinity;
    
    return localData.filter(d => {
        const t = new Date(d.timestamp).getTime();
        return t >= startTs && t <= endTs;
    });
  }, [localData, filterStart, filterEnd, isStreaming]);

  // Calculate basic stats
  const stats = useMemo(() => {
    if (filteredData.length === 0) return { avgUser: 0, avgSys: 0, maxTotal: 0, avgMem: 0, count: 0 };
    let sumUser = 0;
    let sumSys = 0;
    let sumMem = 0;
    let maxTotal = 0;
    let memCount = 0;

    filteredData.forEach(d => {
      sumUser += d.cpu_user_percent;
      sumSys += d.cpu_sys_percent;
      const total = d.cpu_user_percent + d.cpu_sys_percent;
      if (total > maxTotal) maxTotal = total;

      if (d.memory_percent !== undefined) {
        sumMem += d.memory_percent;
        memCount++;
      }
    });
    return {
      avgUser: (sumUser / filteredData.length).toFixed(1),
      avgSys: (sumSys / filteredData.length).toFixed(1),
      maxTotal: maxTotal.toFixed(1),
      avgMem: memCount > 0 ? (sumMem / memCount).toFixed(1) : 'N/A',
      count: filteredData.length
    };
  }, [filteredData]);

  // Logic to detect threshold incidents (sustained for 3+ consecutive points)
  const alertIncidents = useMemo(() => {
    const incidents: {start: string, end: string, maxVal: number}[] = [];
    let consecutiveCount = 0;
    let currentStart: string | null = null;
    let currentMax = 0;

    filteredData.forEach((d, idx) => {
        const total = d.cpu_user_percent + d.cpu_sys_percent;
        if (total > cpuThreshold) {
            if (consecutiveCount === 0) {
                currentStart = d.timestamp;
                currentMax = total;
            } else {
                currentMax = Math.max(currentMax, total);
            }
            consecutiveCount++;
        } else {
            if (consecutiveCount >= 3 && currentStart) {
                 const prev = filteredData[idx-1];
                 incidents.push({
                     start: currentStart,
                     end: prev.timestamp,
                     maxVal: currentMax
                 });
            }
            consecutiveCount = 0;
            currentStart = null;
            currentMax = 0;
        }
    });
    
    if (consecutiveCount >= 3 && currentStart) {
         const last = filteredData[filteredData.length-1];
         incidents.push({
             start: currentStart,
             end: last.timestamp,
             maxVal: currentMax
         });
    }
    return incidents;
  }, [filteredData, cpuThreshold]);

  const handleAnalyze = async () => {
    if (isStreaming) {
      if (!confirm("Analyzing will pause the live stream. Continue?")) return;
      setIsStreaming(false);
    }
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeCpuData(filteredData);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAnalysis = () => {
    if (analysis) {
      localStorage.setItem('cpu_analysis_result', JSON.stringify(analysis));
      setHasSavedAnalysis(true);
      alert("Analysis saved to local storage!");
    }
  };

  const handleLoadAnalysis = () => {
    const saved = localStorage.getItem('cpu_analysis_result');
    if (saved) {
      try {
        setAnalysis(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved analysis", e);
      }
    }
  };

  // Format timestamp for X-axis
  const formattedData = useMemo(() => {
      return filteredData.map(d => ({
          ...d,
          timeLabel: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }))
  }, [filteredData]);

  const resetFilters = () => {
      if (localData.length > 0) {
        const formatForInput = (ts: string) => ts.length >= 16 ? ts.substring(0, 16) : ts;
        setFilterStart(formatForInput(localData[0].timestamp));
        setFilterEnd(formatForInput(localData[localData.length - 1].timestamp));
      }
  };

  const toggleStream = () => {
    setIsStreaming(!isStreaming);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onReset}
              className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-bold text-lg text-white flex items-center gap-2">
                {isStreaming ? (
                    <Zap className="text-yellow-400 animate-pulse" size={20} fill="currentColor" />
                ) : (
                    <Activity className="text-blue-400" size={20} />
                )}
                Process Analysis {isStreaming && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
              </h1>
              <p className="text-xs text-slate-400 font-mono">PID: {initialData[0]?.pid || 'Unknown'} • {stats.count} Samples</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Streaming Toggle */}
             <button
                onClick={toggleStream}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                    isStreaming 
                    ? 'bg-red-900/20 text-red-400 border-red-900/50 hover:bg-red-900/40' 
                    : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700 hover:text-white'
                }`}
             >
                {isStreaming ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                <span className="hidden sm:inline">{isStreaming ? 'Pause Stream' : 'Go Live'}</span>
             </button>

            {hasSavedAnalysis && !isStreaming && (
              <button 
                onClick={handleLoadAnalysis}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
                title="Load last saved analysis"
              >
                <DownloadCloud size={18} />
                <span className="hidden sm:inline">Load Saved</span>
              </button>
            )}

            {analysis && (
               <button
                  onClick={handleSaveAnalysis}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
                  title="Save analysis locally"
               >
                  <Save size={18} />
                  <span className="hidden sm:inline">Save</span>
               </button>
            )}

            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || filteredData.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                analysis 
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/50' 
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30'
                } ${isAnalyzing ? 'opacity-75 cursor-wait' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {isAnalyzing ? (
                <RefreshCw className="animate-spin" size={16} />
                ) : (
                <BrainCircuit size={16} />
                )}
                {analysis ? 'Re-Analyze' : 'Analyze with Gemini'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 space-y-6">
        
        {/* Filter Toolbar - Disabled during streaming */}
        <div className={`bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-wrap items-center gap-4 transition-opacity ${isStreaming ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            <div className="flex items-center gap-2 text-slate-400 mr-2">
                <Filter size={16} />
                <span className="text-sm font-medium">Time Range</span>
            </div>
            
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                    <label className="absolute -top-2 left-2 text-[10px] bg-slate-800 px-1 text-slate-400">Start Time</label>
                    <input 
                        type="datetime-local" 
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        value={filterStart}
                        onChange={(e) => setFilterStart(e.target.value)}
                    />
                </div>
                <span className="text-slate-500">-</span>
                <div className="relative flex-1">
                    <label className="absolute -top-2 left-2 text-[10px] bg-slate-800 px-1 text-slate-400">End Time</label>
                    <input 
                        type="datetime-local" 
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        value={filterEnd}
                        onChange={(e) => setFilterEnd(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2 border-r pr-4 mr-2 pointer-events-auto">
                <span className="text-sm font-medium text-slate-400 whitespace-nowrap">Alert Limit:</span>
                <div className="relative flex items-center">
                    <input 
                        type="number" 
                        min="1" 
                        max="100"
                        value={cpuThreshold}
                        onChange={(e) => setCpuThreshold(Math.min(100, Math.max(1, Number(e.target.value))))}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <span className="ml-2 text-slate-500 text-sm">%</span>
                </div>
            </div>

            <button 
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-3 py-2 rounded hover:bg-slate-700 transition-colors ml-auto"
            >
                <X size={14} />
                Reset Filters
            </button>
        </div>
        
        {isStreaming && (
            <div className="text-center -mt-2 text-xs text-yellow-500/70 animate-pulse">
                Stream Active: Displaying last {MAX_HISTORY} seconds of data. Time filters disabled.
            </div>
        )}

        {/* Alert Banner */}
        {alertIncidents.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-4 animate-in slide-in-from-top-2 shadow-lg shadow-red-900/10">
                <div className="p-3 bg-red-500/20 rounded-lg text-red-400 shrink-0">
                    <AlertTriangle size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                        High CPU Usage Detected
                        <span className="text-xs font-normal bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30">
                            {alertIncidents.length} Incident{alertIncidents.length > 1 ? 's' : ''}
                        </span>
                    </h3>
                    <p className="text-slate-300 text-sm mt-1">
                        Process exceeded the <span className="font-mono font-bold text-red-300">{cpuThreshold}%</span> threshold 
                        for sustained periods (3+ consecutive samples).
                    </p>
                    <div className="mt-3 text-xs text-red-300/70 font-mono bg-red-950/30 p-2 rounded inline-block border border-red-900/30">
                        Most recent: {new Date(alertIncidents[alertIncidents.length-1].start).toLocaleTimeString()} 
                        {' '}-{' '}
                        {new Date(alertIncidents[alertIncidents.length-1].end).toLocaleTimeString()}
                        <span className="ml-2 text-red-400 font-bold">
                            (Peak: {alertIncidents[alertIncidents.length-1].maxVal.toFixed(1)}%)
                        </span>
                    </div>
                </div>
            </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity size={48} />
            </div>
            <p className="text-slate-400 text-sm font-medium">Avg User CPU</p>
            <p className="text-3xl font-bold text-blue-400 mt-1">{stats.avgUser}%</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity size={48} />
            </div>
            <p className="text-slate-400 text-sm font-medium">Avg System CPU</p>
            <p className="text-3xl font-bold text-rose-400 mt-1">{stats.avgSys}%</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity size={48} />
            </div>
            <p className="text-slate-400 text-sm font-medium">Peak Total CPU</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">{stats.maxTotal}%</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Activity size={48} />
            </div>
            <p className="text-slate-400 text-sm font-medium">Avg Memory</p>
            <p className="text-3xl font-bold text-purple-400 mt-1">{stats.avgMem}%</p>
          </div>
        </div>

        {/* CPU Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
             CPU Usage Over Time 
             {isStreaming && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>}
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUser" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSys" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                    dataKey="timeLabel" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false}
                    minTickGap={30}
                />
                <YAxis 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    unit="%"
                    domain={[0, 100]}
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <Tooltip 
                    content={<CustomTooltip />} 
                    wrapperStyle={{ outline: 'none', pointerEvents: 'auto' }}
                    cursor={{ stroke: '#475569', strokeWidth: 1 }}
                />
                <Area 
                    type="monotone" 
                    dataKey="cpu_user_percent" 
                    stackId="1" 
                    stroke="#3b82f6" 
                    fill="url(#colorUser)" 
                    name="User CPU"
                    isAnimationActive={!isStreaming}
                    animationDuration={500}
                />
                <Area 
                    type="monotone" 
                    dataKey="cpu_sys_percent" 
                    stackId="1" 
                    stroke="#f43f5e" 
                    fill="url(#colorSys)" 
                    name="System CPU"
                    isAnimationActive={!isStreaming}
                    animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory Chart */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-slate-200 mb-6">Memory Usage Over Time</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c084fc" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                    dataKey="timeLabel" 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false}
                    minTickGap={30}
                />
                <YAxis 
                    stroke="#64748b" 
                    fontSize={12} 
                    tickLine={false} 
                    unit="%"
                />
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <Tooltip 
                    content={<CustomTooltip />} 
                    wrapperStyle={{ outline: 'none', pointerEvents: 'auto' }}
                    cursor={{ stroke: '#475569', strokeWidth: 1 }}
                />
                <Area 
                    type="monotone" 
                    dataKey="memory_percent" 
                    stroke="#c084fc" 
                    fill="url(#colorMem)" 
                    name="Memory"
                    isAnimationActive={!isStreaming}
                    animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Analysis Report */}
        {analysis && (
          <div className="animate-fade-in-up">
            <div className={`rounded-xl border p-6 ${
              analysis.severity === 'HIGH' ? 'bg-red-900/20 border-red-800' :
              analysis.severity === 'MEDIUM' ? 'bg-yellow-900/20 border-yellow-800' :
              'bg-emerald-900/20 border-emerald-800'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <BrainCircuit size={24} className={
                     analysis.severity === 'HIGH' ? 'text-red-400' :
                     analysis.severity === 'MEDIUM' ? 'text-yellow-400' :
                     'text-emerald-400'
                  } />
                  AI Performance Report
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                     analysis.severity === 'HIGH' ? 'bg-red-500/20 text-red-300' :
                     analysis.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                     'bg-emerald-500/20 text-emerald-300'
                }`}>
                  SEVERITY: {analysis.severity}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5">
                  <h4 className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-2">Summary</h4>
                  <p className="text-slate-200 leading-relaxed">{analysis.summary}</p>
                </div>
                
                <div>
                  <h4 className="text-sm text-slate-400 uppercase tracking-wider font-semibold mb-2">Recommendations</h4>
                  <ul className="grid gap-2">
                    {analysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-3 bg-slate-900/30 p-3 rounded border border-white/5">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-slate-300">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;