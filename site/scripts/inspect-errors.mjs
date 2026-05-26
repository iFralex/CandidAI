#!/usr/bin/env node
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
const db = admin.default.firestore();

const snap = await db.collection("analytics_events")
    .orderBy("timestamp", "desc")
    .limit(1000)
    .get();

const tracker = [];
for (const d of snap.docs) {
    const e = d.data();
    if (e.event !== "app_error") continue;
    const msg = String(e.params?.error_message ?? "");
    if (msg.includes("TrackerStorageType")) tracker.push(e);
}

console.log(`Eventi TrackerStorageType: ${tracker.length}`);
console.log(`\nUnique user_agent prefixes (90 chars):`);
const uaCount = {};
for (const e of tracker) {
    const ua = String(e.user_agent ?? "?").slice(0, 90);
    uaCount[ua] = (uaCount[ua] ?? 0) + 1;
}
for (const [ua, n] of Object.entries(uaCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  [${n}] ${ua}`);
}

console.log(`\nUnique page_path:`);
const pageCount = {};
for (const e of tracker) {
    pageCount[e.page_path ?? "?"] = (pageCount[e.page_path ?? "?"] ?? 0) + 1;
}
for (const [p, n] of Object.entries(pageCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  [${n}] ${p}`);
}

console.log(`\nUnique session_id:`);
const sidCount = {};
for (const e of tracker) {
    sidCount[e.session_id ?? "?"] = (sidCount[e.session_id ?? "?"] ?? 0) + 1;
}
console.log(`  ${Object.keys(sidCount).length} sessioni distinte`);
for (const [s, n] of Object.entries(sidCount).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  [${n}] ${s}`);
}

console.log(`\nFull sample params (first 3 events):`);
for (const e of tracker.slice(0, 3)) {
    console.log(JSON.stringify({ params: e.params, page_path: e.page_path, user_agent: e.user_agent, timestamp: e.timestamp?.toDate?.()?.toISOString?.() }, null, 2));
    console.log("---");
}

process.exit(0);
