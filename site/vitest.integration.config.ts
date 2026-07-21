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
      "firebase-admin/firestore": path.resolve(__dirname, "./node_modules/firebase-admin/lib/firestore/index.js"),
    },
  },
});
