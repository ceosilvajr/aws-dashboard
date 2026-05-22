"use client";

import { SectionShell, RequireProfile, LoadingState, useProfileData, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Lightbulb } from "lucide-react";

interface CostData {
  totalRunningCost: string;
  forecastedCost: string | null;
  daysElapsed: number;
  daysInMonth: number;
  services: { name: string; runningCost: string; projectedCost: string; dailyRate: string }[];
  suggestions: { service: string; suggestion: string; impact: string }[];
}

export function CostAnalysisSection() {
  const { data, loading, refresh } = useProfileData<CostData>("/api/cost-analysis", {
    totalRunningCost: "0", forecastedCost: null, daysElapsed: 0, daysInMonth: 30, services: [], suggestions: [],
  });

  return (
    <SectionShell title="Cost Analysis" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        {loading ? <LoadingState /> : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Running Cost" value={`$${data.totalRunningCost}`} icon={DollarSign} />
              <StatCard label="Expected Month Cost" value={data.forecastedCost ? `$${data.forecastedCost}` : "N/A"} icon={TrendingUp} />
              <StatCard label="Days Elapsed" value={`${data.daysElapsed}/${data.daysInMonth}`} icon={DollarSign} />
              <StatCard label="Daily Avg" value={`$${data.daysElapsed > 0 ? (parseFloat(data.totalRunningCost) / data.daysElapsed).toFixed(2) : "0"}`} icon={TrendingUp} />
            </div>

            {/* Service Breakdown */}
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-3">Cost Breakdown by Service</h3>
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Running Cost</TableHead>
                      <TableHead className="text-right">Daily Rate</TableHead>
                      <TableHead className="text-right">Projected Month</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.services.map((s) => (
                      <TableRow key={s.name}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-right">${s.runningCost}</TableCell>
                        <TableCell className="text-right text-muted-foreground">${s.dailyRate}</TableCell>
                        <TableCell className="text-right">${s.projectedCost}</TableCell>
                      </TableRow>
                    ))}
                    {data.services.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No cost data available</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Savings Suggestions */}
            {data.suggestions.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" /> Savings Suggestions
                </h3>
                <div className="space-y-3">
                  {data.suggestions.map((s, i) => (
                    <Card key={i}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{s.service}</p>
                            <p className="text-sm text-muted-foreground">{s.suggestion}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0">{s.impact}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </RequireProfile>
    </SectionShell>
  );
}
