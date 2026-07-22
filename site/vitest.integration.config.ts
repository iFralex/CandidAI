import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["../tests/integration/setup.ts"],
    globals: true,
    include: ["../tests/integration/**/*.test.ts"],
    server: {
      deps: { inline: ["resend", "stripe"] },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./vitest/server-only.ts"),
      "resend": path.resolve(__dirname, "./node_modules/resend/dist/index.mjs"),
      "stripe": path.resolve(__dirname, "./node_modules/stripe/esm/stripe.esm.node.js"),
      "next/headers": path.resolve(__dirname, "./node_modules/next/headers.js"),
      // Force single-file resolution (ESM entry) for these dual CJS/ESM packages.
      // Without this, a bare `import ... from "next/navigation"` (or
      // "next-firebase-auth-edge") inside src/ files resolves to a *different*
      // physical file than the same specifier imported directly from a test file,
      // so `vi.mock(...)` only intercepts one of the two — the real, unmocked
      // implementation runs from the other, silently breaking every test that
      // depends on checkAuth()/redirect() being mocked (fixed 2026-07-21).
      "next/navigation": path.resolve(__dirname, "./node_modules/next/navigation.js"),
      "next/cache": path.resolve(__dirname, "./node_modules/next/cache.js"),
      "next-firebase-auth-edge/next/cookies": path.resolve(__dirname, "./node_modules/next-firebase-auth-edge/esm/next/cookies/index.js"),
      "next-firebase-auth-edge": path.resolve(__dirname, "./node_modules/next-firebase-auth-edge/esm/index.js"),
      "firebase-admin/firestore": path.resolve(__dirname, "./node_modules/firebase-admin/lib/firestore/index.js"),
    },
  },
});
