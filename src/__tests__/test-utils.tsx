// src/__tests__/test-utils.tsx
import { render, RenderOptions } from "@testing-library/react";
import { ReactElement, ReactNode, useEffect } from "react";
import { ProfileProvider, useProfile } from "@/context/profile-context";
import { NavProvider } from "@/context/nav-context";
import { RegionProvider, useRegion } from "@/context/region-context";

// Setters are child components that call context setters after mount,
// allowing tests to inject initial values without exporting context objects.
function ProfileSetter({ profile }: { profile: string | null }) {
  const { setProfile } = useProfile();
  useEffect(() => { setProfile(profile); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function RegionSetter({ region }: { region: string }) {
  const { setRegion } = useRegion();
  useEffect(() => { setRegion(region); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export interface TestRenderOptions extends Omit<RenderOptions, "wrapper"> {
  profile?: string | null;
  region?: string;
}

/**
 * Renders ui wrapped in ProfileProvider + NavProvider + RegionProvider.
 * RegionProvider fetches /api/config on mount — stub fetch before calling this:
 *   vi.stubGlobal("fetch", mockFetch)  where mockFetch handles /api/config
 */
export function renderWithProviders(
  ui: ReactElement,
  { profile = null, region = "ap-southeast-1", ...rest }: TestRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ProfileProvider>
        <ProfileSetter profile={profile} />
        <NavProvider>
          <RegionProvider>
            <RegionSetter region={region} />
            {children}
          </RegionProvider>
        </NavProvider>
      </ProfileProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}

/** Default fetch stub that handles /api/config and returns empty for everything else. */
export function makeConfigFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn((url: string) => {
    if (url.includes("/api/config")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            defaultRegion: "ap-southeast-1",
            regions: ["ap-southeast-1", "us-east-1"],
          }),
      });
    }
    const key = Object.keys(overrides).find((k) => url.includes(k));
    const data = key ? overrides[key] : {};
    return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
  });
}
