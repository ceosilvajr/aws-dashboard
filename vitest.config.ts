import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/app/layout.tsx",
        "src/app/page.tsx",
        "src/components/ui/**",
        "src/components/theme-provider.tsx",
        "src/components/theme-toggle.tsx",
        "src/__tests__/**",
        "src/test-setup.ts",
        "src/components/sections/networking-section.tsx",
        "src/components/sections/s3-bucket-detail.tsx",
        "src/components/sections/cognito-pool-detail.tsx",
        "src/components/sections/dashboard-section.tsx",
        "src/components/sections/dynamodb-section.tsx",
        "src/components/sections/ecs-section.tsx",
        "src/components/sections/lambda-section.tsx",
        "src/components/sections/amplify-section.tsx",
        "src/components/sections/settings-section.tsx",
        "src/components/stacks-section.tsx",
        "src/components/overview-section.tsx",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      reporter: ["text-summary", "lcov"],
    },
  },
});
