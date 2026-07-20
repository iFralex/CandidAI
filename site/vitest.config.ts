import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, ".."), __dirname],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["../tests/unit/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/font/google": path.resolve(__dirname, "./vitest/next-font-google-mock.ts"),
      "@testing-library/react": path.resolve(__dirname, "./node_modules/@testing-library/react/dist/index.js"),
      "@testing-library/user-event": path.resolve(__dirname, "./node_modules/@testing-library/user-event/dist/esm/index.js"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js"),
      "react": path.resolve(__dirname, "./node_modules/react/index.js"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom/index.js"),
      "@stripe/react-stripe-js": path.resolve(__dirname, "./node_modules/@stripe/react-stripe-js/dist/react-stripe.esm.mjs"),
      "@stripe/stripe-js": path.resolve(__dirname, "./node_modules/@stripe/stripe-js/dist/index.mjs"),
    },
  },
});
