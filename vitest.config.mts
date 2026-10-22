import react from "@vitejs/plugin-react";
import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": path.resolve(
        import.meta.dirname,
        "./__tests__/server-only-stub.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["app/**", "lib/**"],
      reporter: ["text-summary", "html"],
    },
  },
});

