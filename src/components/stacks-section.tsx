"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/context/profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";

interface StackInfo {
  name: string;
  status: string;
  created: string;
  updated: string;
  description: string;
}

function statusVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  if (status.includes("COMPLETE") && !status.includes("ROLLBACK")) return "default";
  if (status.includes("ROLLBACK") || status.includes("FAILED")) return "destructive";
  if (status.includes("IN_PROGRESS")) return "secondary";
  return "outline";
}

export function StacksSection() {
  const { profile } = useProfile();
  const [stacks, setStacks] = useState<StackInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile) { setStacks([]); return; } // eslint-disable-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/stacks?profile=${profile}`)
      .then((r) => r.json())
      .then((d) => setStacks(d.stacks ?? []))
      .catch(() => setStacks([]))
      .finally(() => setLoading(false));
  }, [profile]);

  // Auto-refresh when any stack is in progress
  useEffect(() => {
    if (!profile || !stacks.some((s) => s.status.includes("IN_PROGRESS"))) return;
    const id = setInterval(() => {
      fetch(`/api/stacks?profile=${profile}`)
        .then((r) => r.json())
        .then((d) => setStacks(d.stacks ?? []))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [profile, stacks]);

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select an AWS profile to view CloudFormation stacks
        </CardContent>
      </Card>
    );
  }

  const filtered = search
    ? stacks.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : stacks;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">CloudFormation Stacks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter stacks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {loading ? (
          <div className="py-8 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stack Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{s.created ? new Date(s.created).toLocaleDateString() : ""}</TableCell>
                    <TableCell className="text-xs">{s.updated ? new Date(s.updated).toLocaleDateString() : ""}</TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">{s.description}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {search ? "No stacks match filter" : "No stacks found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
