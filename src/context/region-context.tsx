"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "aws-dashboard-region";

interface RegionContextType {
  region: string;
  setRegion: (r: string) => void;
  regions: string[];
  loading: boolean;
}

const RegionContext = createContext<RegionContextType>({
  region: "us-east-1", setRegion: () => {}, regions: [], loading: true,
});

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<string>("us-east-1");
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(({ defaultRegion, regions: rs }: { defaultRegion: string; regions: string[] }) => {
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        setRegionState(stored ?? defaultRegion);
        setRegions(rs);
      })
      .finally(() => setLoading(false));
  }, []);

  const setRegion = (r: string) => {
    setRegionState(r);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, r);
  };

  return (
    <RegionContext.Provider value={{ region, setRegion, regions, loading }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
