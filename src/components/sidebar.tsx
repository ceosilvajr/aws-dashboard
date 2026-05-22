"use client";

import { useProfile } from "@/context/profile-context";
import { useNav, type Section } from "@/context/nav-context";
import { useAccounts } from "@/context/accounts-context";
import { useRegion } from "@/context/region-context";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard, Server, Network, HardDrive, Shield, Globe, Webhook,
  Layers, Settings, ChevronLeft, ChevronRight, ChevronDown, UserPlus, Container, Users, Table2, Zap, Smartphone, TrendingDown,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS: { id: Section; label: string; icon: typeof LayoutDashboard; group?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "ecs", label: "ECS Services", icon: Server, group: "Resources" },
  { id: "ecr", label: "ECR Registry", icon: Container, group: "Resources" },
  { id: "networking", label: "Networking", icon: Network, group: "Resources" },
  { id: "s3", label: "S3 Buckets", icon: HardDrive, group: "Resources" },
  { id: "security", label: "Security", icon: Shield, group: "Resources" },
  { id: "cdn", label: "CDN", icon: Globe, group: "Resources" },
  { id: "api", label: "API Gateway", icon: Webhook, group: "Resources" },
  { id: "cognito", label: "Cognito", icon: Users, group: "Resources" },
  { id: "dynamodb", label: "DynamoDB", icon: Table2, group: "Resources" },
  { id: "lambda", label: "Lambda", icon: Zap, group: "Resources" },
  { id: "amplify", label: "Amplify", icon: Smartphone, group: "Resources" },
  { id: "stacks", label: "CloudFormation", icon: Layers, group: "Operations" },
  { id: "cost-analysis", label: "Cost Analysis", icon: TrendingDown, group: "Operations" },
  { id: "accounts", label: "Accounts", icon: UserPlus, group: "Operations" },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { section, setSection } = useNav();
  const { profile, setProfile } = useProfile();
  const { region, setRegion, regions } = useRegion();
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const { accounts } = useAccounts();
  const current = accounts.find((a) => a.profile === profile);
  const groups = [...new Set(NAV_ITEMS.map((i) => i.group).filter(Boolean))] as string[];

  return (
    <aside className={`flex flex-col border-r bg-card transition-all duration-200 ${collapsed ? "w-16" : "w-64"}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b shrink-0">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-bold text-sm">DG</span>
        </div>
        {!collapsed && <span className="font-semibold text-sm truncate">DevSecOps</span>}
      </div>

      {/* Account Selector */}
      <div className="px-3 py-3 border-b shrink-0">
        {collapsed ? (
          <button
            onClick={() => setAccountOpen(!accountOpen)}
            className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold"
            title={current?.name ?? "All Accounts"}
          >
            {current ? current.name.charAt(0).toUpperCase() : "A"}
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setAccountOpen(!accountOpen)}
              className="w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary text-xs font-bold">{current ? current.name.charAt(0).toUpperCase() : "A"}</span>
                </div>
                <span className="truncate">{current?.name ?? "All Accounts"}</span>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${accountOpen ? "rotate-180" : ""}`} />
            </button>
            {accountOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border bg-popover shadow-lg py-1 max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setProfile(null); setAccountOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${!profile ? "bg-accent font-medium" : ""}`}
                >
                  All Accounts
                </button>
                {accounts.map((a) => (
                  <button
                    key={a.profile}
                    onClick={() => { setProfile(a.profile); setAccountOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${profile === a.profile ? "bg-accent font-medium" : ""}`}
                  >
                    <div className="truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.id}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Region Picker */}
      {!collapsed && (
        <div className="px-3 py-2 border-b shrink-0">
          <select
            className="w-full text-xs rounded border border-input bg-transparent px-2 py-1 text-muted-foreground"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            title="AWS Region"
          >
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {NAV_ITEMS.filter((i) => !i.group).slice(0, 1).map((item) => (
          <NavButton key={item.id} item={item} active={section === item.id} collapsed={collapsed} onClick={() => setSection(item.id)} />
        ))}

        {groups.map((group) => (
          <div key={group}>
            {!collapsed && <div className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group}</div>}
            {collapsed && <div className="my-2 mx-2 border-t" />}
            {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
              <NavButton key={item.id} item={item} active={section === item.id} collapsed={collapsed} onClick={() => setSection(item.id)} />
            ))}
          </div>
        ))}

        {NAV_ITEMS.filter((i) => !i.group && i.id !== "dashboard").map((item) => (
          <NavButton key={item.id} item={item} active={section === item.id} collapsed={collapsed} onClick={() => setSection(item.id)} />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-2 py-2 flex items-center justify-between shrink-0">
        {!collapsed && <ThemeToggle />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

function NavButton({ item, active, collapsed, onClick }: {
  item: { id: string; label: string; icon: typeof LayoutDashboard };
  active: boolean; collapsed: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}
