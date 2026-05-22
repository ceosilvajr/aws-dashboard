"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { DynamicAccount } from "@/lib/aws-config-parser";

const STORAGE_KEY = "aws-dashboard-enabled-groups";

interface AccountsContextType {
  accounts: DynamicAccount[];
  allAccounts: DynamicAccount[];
  groups: string[];
  enabledGroups: string[];
  setEnabledGroups: (groups: string[]) => void;
  loading: boolean;
}

const AccountsContext = createContext<AccountsContextType>({
  accounts: [], allAccounts: [], groups: [], enabledGroups: [],
  setEnabledGroups: () => {}, loading: true,
});

export function AccountsProvider({ children }: { children: ReactNode }) {
  const [allAccounts, setAllAccounts] = useState<DynamicAccount[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [enabledGroups, setEnabledGroupsState] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data) => {
        const discoveredGroups: string[] = data.groups ?? [];
        setAllAccounts(data.accounts);
        setGroups(discoveredGroups);
        // Default to all discovered groups when no user preference is stored
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        setEnabledGroupsState(stored ? JSON.parse(stored) : discoveredGroups);
      })
      .finally(() => setLoading(false));
  }, []);

  const setEnabledGroups = useCallback((g: string[]) => {
    setEnabledGroupsState(g);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(g));
  }, []);

  const accounts = allAccounts.filter((a) => enabledGroups.includes(a.group));

  return (
    <AccountsContext.Provider value={{ accounts, allAccounts, groups, enabledGroups, setEnabledGroups, loading }}>
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  return useContext(AccountsContext);
}
