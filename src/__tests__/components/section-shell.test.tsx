// src/__tests__/components/section-shell.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionShell, RequireProfile, StatusBadge, StatCard } from "@/components/section-shell";
import { ProfileProvider } from "@/context/profile-context";
import { Bell } from "lucide-react";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ defaultRegion: "ap-southeast-1", regions: ["ap-southeast-1"] }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SectionShell", () => {
  it("renders the title", () => {
    render(<SectionShell title="My Title"><div /></SectionShell>);
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("shows refresh button when onRefresh is provided", () => {
    render(<SectionShell title="T" onRefresh={vi.fn()}><div /></SectionShell>);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    render(<SectionShell title="T" onRefresh={onRefresh}><div /></SectionShell>);
    fireEvent.click(screen.getByText("Refresh"));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("disables refresh button when loading is true", () => {
    render(<SectionShell title="T" onRefresh={vi.fn()} loading><div /></SectionShell>);
    expect(screen.getByText("Refresh").closest("button")).toBeDisabled();
  });

  it("renders children", () => {
    render(<SectionShell title="T"><span>hello</span></SectionShell>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("does not show refresh button when onRefresh is not provided", () => {
    render(<SectionShell title="T"><div /></SectionShell>);
    expect(screen.queryByText("Refresh")).toBeNull();
  });
});

describe("RequireProfile", () => {
  it("shows prompt when no profile is selected", () => {
    render(
      <ProfileProvider>
        <RequireProfile><span>content</span></RequireProfile>
      </ProfileProvider>
    );
    expect(screen.getByText(/Select an AWS account/i)).toBeInTheDocument();
    expect(screen.queryByText("content")).toBeNull();
  });
});

describe("StatusBadge", () => {
  const cases: [string, "default" | "destructive" | "secondary" | "outline"][] = [
    ["ACTIVE", "default"],
    ["COMPLETE", "default"],
    ["AVAILABLE", "default"],
    ["HEALTHY", "default"],
    ["FAILED", "destructive"],
    ["ERROR", "destructive"],
    ["UNHEALTHY", "destructive"],
    ["IN_PROGRESS", "secondary"],
    ["PENDING", "secondary"],
    ["CREATING", "secondary"],
    ["UNKNOWN_STATUS", "outline"],
  ];

  cases.forEach(([status]) => {
    it(`renders "${status}" badge`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
    });
  });
});

describe("StatCard", () => {
  it("renders label and numeric value", () => {
    render(<StatCard label="Total" value={42} icon={Bell} />);
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<StatCard label="Region" value="ap-southeast-1" icon={Bell} />);
    expect(screen.getByText("ap-southeast-1")).toBeInTheDocument();
  });
});
