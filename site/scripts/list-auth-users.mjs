#!/usr/bin/env node
/** List all Firebase Auth users sorted by creation date, with heuristic test-account flag. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8");
for (const line of envText.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
    }
}

const admin = await import("firebase-admin");
admin.default.initializeApp({
    credential: admin.default.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
});

const auth = admin.default.auth();
let users = [];
let next;
do {
    const page = await auth.listUsers(1000, next);
    users.push(...page.users);
    next = page.pageToken;
} while (next);

// Heuristic: flag obvious test accounts
const TEST_KEYWORDS = ["test", "alessio", "ifralex", "antonucci", "asd", "qwe", "abc", "demo", "fake", "candidai", "prova", "francesca", "francesco", "alex", "francisco"];
function isLikelyTest(email = "") {
    const e = email.toLowerCase();
    if (TEST_KEYWORDS.some((k) => e.includes(k))) return true;
    if (/^[a-z]{1,4}@/.test(e)) return true; // very short local part
    if (/^[a-z]+\d{3,}@/.test(e) && !/gmail|outlook|yahoo|icloud|hotmail/.test(e)) return true;
    return false;
}

users.sort((a, b) => new Date(a.metadata.creationTime) - new Date(b.metadata.creationTime));

console.log(`Totale: ${users.length}\n`);
console.log("#    created              flag  email");
console.log("─".repeat(95));
users.forEach((u, i) => {
    const c = (u.metadata.creationTime ?? "").slice(0, 19).replace("T", " ");
    const flag = isLikelyTest(u.email) ? "TEST" : "    ";
    const idx = String(i + 1).padStart(3);
    console.log(`${idx}  ${c}  ${flag}  ${u.email ?? "(no email)"}`);
});
process.exit(0);
