import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig keeps JSX for Next ("preserve"); a test that renders a
  // component needs it compiled, with React's automatic runtime.
  esbuild: { jsx: "automatic" },
  // A component may import its own stylesheet (components/icons/flat/
  // FlatDrawing.tsx). Tests never read the CSS, so it is not run through
  // the app's PostCSS (Tailwind's plugin, which Vite's loader rejects).
  css: { postcss: {} },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Empty under test; in a build it stops a server file reaching the
      // browser (lib/test-stubs/server-only.ts).
      "server-only": path.resolve(__dirname, "lib/test-stubs/server-only.ts"),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
