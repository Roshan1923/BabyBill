import React, { createContext, useContext, useState, useCallback } from 'react';

const ScanContext = createContext();

export function ScanProvider({ children }) {
  const [scans, setScans] = useState([]);

  const addScan = useCallback((scan) => {
    setScans((prev) => [
      ...prev,
      { ...scan, id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
    ]);
  }, []);

  const removeScan = useCallback((id) => {
    setScans((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearScans = useCallback(() => {
    setScans([]);
  }, []);

  const getScans = useCallback(() => scans, [scans]);

  return (
    <ScanContext.Provider value={{ scans, addScan, removeScan, clearScans, getScans }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScanQueue() {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error('useScanQueue must be used within a ScanProvider');
  }
  return context;
}