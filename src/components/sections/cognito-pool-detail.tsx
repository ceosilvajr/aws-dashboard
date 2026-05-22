"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Play, RefreshCw, Users } from "lucide-react";

interface PoolDetailProps {
  poolId: string;
  poolName: string;
  profile: string;
  onBack: () => void;
}

interface StatusCounts {
  CONFIRMED: number;
  UNCONFIRMED: number;
  ARCHIVED: number;
  COMPROMISED: number;
  UNKNOWN: number;
  RESET_REQUIRED: number;
  FORCE_CHANGE_PASSWORD: number;
  total: number;
}

type QuickFilter = "all" | "24h" | "7d" | "30d" | "mtd" | "eom" | "custom";

function getDateRange(filter: QuickFilter): { from: string; to: string } | null {
  if (filter === "all") return null;
  const now = new Date();
  const to = now.toISOString();
  if (filter === "24h") return { from: new Date(now.getTime() - 86400000).toISOString(), to };
  if (filter === "7d") return { from: new Date(now.getTime() - 7 * 86400000).toISOString(), to };
  if (filter === "30d") return { from: new Date(now.getTime() - 30 * 86400000).toISOString(), to };
  if (filter === "mtd") return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to };
  return null;
}

const STATUS_LABELS: { key: keyof Omit<StatusCounts, "total">; label: string; color: string }[] = [
  { key: "CONFIRMED", label: "Confirmed", color: "bg-green-500" },
  { key: "UNCONFIRMED", label: "Unconfirmed", color: "bg-yellow-500" },
  { key: "FORCE_CHANGE_PASSWORD", label: "Force Change Password", color: "bg-orange-500" },
  { key: "RESET_REQUIRED", label: "Reset Required", color: "bg-orange-400" },
  { key: "COMPROMISED", label: "Compromised", color: "bg-red-500" },
  { key: "ARCHIVED", label: "Archived", color: "bg-gray-500" },
  { key: "UNKNOWN", label: "Unknown", color: "bg-gray-400" },
];

export function CognitoPoolDetail({ poolId, poolName, profile, onBack }: PoolDetailProps) {
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [activeFilter, setActiveFilter] = useState<QuickFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [eomMonth, setEomMonth] = useState(new Date().getMonth());
  const [eomYear, setEomYear] = useState(new Date().getFullYear());

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    let url = `/api/cognito/detail?poolId=${encodeURIComponent(poolId)}&profile=${encodeURIComponent(profile)}`;
    let range: { from: string; to: string } | null = null;
    if (activeFilter === "custom") {
      range = customFrom && customTo ? { from: new Date(customFrom).toISOString(), to: new Date(customTo + "T23:59:59").toISOString() } : null;
    } else if (activeFilter === "eom") {
      const start = new Date(eomYear, eomMonth, 1);
      const end = new Date(eomYear, eomMonth + 1, 0, 23, 59, 59);
      range = { from: start.toISOString(), to: end.toISOString() };
    } else {
      range = getDateRange(activeFilter);
    }
    if (range) url += `&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    try {
      const data = await fetch(url).then((r) => r.json());
      setCounts(data);
    } catch { setCounts(null); }
    setLoading(false);
  }, [poolId, profile, activeFilter, customFrom, customTo, eomMonth, eomYear]);

  const runDisabled = loading || (activeFilter === "custom" && (!customFrom || !customTo));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <div>
          <h2 className="text-lg font-semibold">{poolName}</h2>
          <p className="text-xs text-muted-foreground font-mono">{poolId}</p>
        </div>
      </div>

      {/* Filter + Run */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date Range</label>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as QuickFilter)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="mtd">Month to Date</option>
                <option value="eom">End of Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {activeFilter === "custom" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Start</label>
                  <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">End</label>
                  <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
                </div>
              </>
            )}
            {activeFilter === "eom" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Month</label>
                  <select
                    value={eomMonth}
                    onChange={(e) => setEomMonth(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Year</label>
                  <select
                    value={eomYear}
                    onChange={(e) => setEomYear(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <Button size="sm" onClick={fetchCounts} disabled={runDisabled}>
              <Play className="h-3.5 w-3.5 mr-1" />Run
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {loading ? (
        <Card><CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Counting users…</p>
        </CardContent></Card>
      ) : counts ? (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{counts.total.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">total users</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {STATUS_LABELS.map(({ key, label, color }) => (
                  counts[key] > 0 && (
                    <div key={key} className="flex items-center gap-2 rounded-lg border p-3">
                      <div className={`h-3 w-3 rounded-full ${color}`} />
                      <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-semibold">{counts[key].toLocaleString()}</p>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </CardContent>
          </Card>

          {counts.total > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="h-4 rounded-full overflow-hidden flex">
                  {STATUS_LABELS.map(({ key, color }) => {
                    const pct = (counts[key] / counts.total) * 100;
                    return pct > 0 ? <div key={key} className={`${color} h-full`} style={{ width: `${pct}%` }} title={`${key}: ${counts[key]}`} /> : null;
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {STATUS_LABELS.map(({ key, label, color }) => (
                    counts[key] > 0 && (
                      <div key={key} className="flex items-center gap-1 text-xs">
                        <div className={`h-2 w-2 rounded-full ${color}`} />
                        <span>{label} ({((counts[key] / counts.total) * 100).toFixed(1)}%)</span>
                      </div>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : !hasRun ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Select a date range and click Run to query users.</CardContent></Card>
      ) : (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Failed to load data</CardContent></Card>
      )}
    </div>
  );
}
