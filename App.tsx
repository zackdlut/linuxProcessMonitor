import React, { useState } from 'react';
import SetupView from './components/SetupView';
import Dashboard from './components/Dashboard';
import { AppState, CpuLogEntry } from './types';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.SETUP);
  const [data, setData] = useState<CpuLogEntry[]>([]);

  const handleDataLoaded = (loadedData: CpuLogEntry[]) => {
    setData(loadedData);
    setState(AppState.DASHBOARD);
  };

  const handleReset = () => {
    setData([]);
    setState(AppState.SETUP);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-blue-500/30">
      {state === AppState.SETUP ? (
        <SetupView onDataLoaded={handleDataLoaded} />
      ) : (
        <Dashboard data={data} onReset={handleReset} />
      )}
    </div>
  );
};

export default App;
