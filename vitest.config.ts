import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig keeps JSX for Next ("preserve"); a test that renders a
  // component needs it compiled, with React's automatic runtime.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
