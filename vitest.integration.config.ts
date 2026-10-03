import { existsSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "vitest/config"

// The keys of the local Supabase live in .env.local (gitignored); Node reads it without any extra package.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/setup-msw.ts"],
    // One database: files run one after another so tests do not disturb each other.
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
})
