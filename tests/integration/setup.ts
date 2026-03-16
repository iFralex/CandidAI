import { readFileSync } from "fs";
import path from "path";

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const raw = trimmed.slice(eqIndex + 1).trim();
      const value = raw.replace(/^(["'])(.*)\1$/, "$2");
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // file not found — skip
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.test.local"));
loadEnvFile(path.resolve(process.cwd(), ".env.test"));
