import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig keeps JSX for Next.js to compile; tests (e.g. the blog formatter) need it compiled here.
  esbuild: { jsx: "automatic" },
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: { include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], environment: "node" },
});
