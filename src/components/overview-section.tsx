"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/context/profile-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Database,
  HardDrive,
  Container,
  Globe,
  Zap,
  Layers,
  RefreshCw,
  DollarSign,
} from "lucide-react";

interface OverviewData {
  account: string;
  s3Buckets: number | null;
  dynamoTables: number | null;
  ecrRepos: number | null;
  cloudFrontDistributions: number | null;
  lambdaFunctions: number | null;
  cfnStacks: number | null;
  monthlyCost: string | null;
  topServices: { name: string; cost: string }[] | null;
}

const cards = [
  { key: "s3Buckets", label: "S3 Buckets", icon: HardDrive },
  { key: "dynamoTables", label: "DynamoDB Tables", icon: Database },
  { key: "ecrRepos", label: "ECR Repos", icon: Container },
  { key: "cloudFrontDistributions", label: "CloudFront", icon: Globe },
  { key: "lambdaFunctions", label: "Lambda Functions", icon: Zap },
  { key: "cfnStacks", label: "CF Stacks", icon: Layers },
] as const;

export function OverviewSection() {
  const { profile } = useProfile();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/overview?profile=${profile}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [profile]);

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select an AWS profile to view resource overview
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...cards, { key: "cost", label: "Monthly Cost", icon: DollarSign }].map((c) => (
          <Card key={c.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{data[c.key] ?? "N/A"}</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.monthlyCost ? `$${data.monthlyCost}` : "N/A"}</p>
            {data.topServices && data.topServices.length > 0 && (
              <div className="mt-2 space-y-1">
                {data.topServices.map((s) => (
                  <div key={s.name} className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate mr-2">{s.name}</span>
                    <span>${s.cost}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
