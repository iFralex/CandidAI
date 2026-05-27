#!/usr/bin/env node
/** Audit production Firestore state: collections, counts, key docs, indexes. */
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

console.log("=== Top-level collections ===");
const cols = await db.listCollections();
for (const c of cols) {
    const snap = await c.count().get();
    console.log(`  ${c.id.padEnd(30)} ${snap.data().count} docs`);
}

console.log("\n=== discount_codes (privato, server-only) ===");
const codes = await db.collection("discount_codes").get();
for (const d of codes.docs) {
    const x = d.data();
    console.log(`  ${d.id.padEnd(15)} type=${x.type} value=${x.value} enabled=${x.enabled} used=${x.used_count} max=${x.max_uses ?? "∞"}`);
}

console.log("\n=== analytics_cache ===");
const cache = await db.collection("analytics_cache").get();
for (const d of cache.docs) {
    const x = d.data();
    console.log(`  ${d.id}: fetched=${x.fetchedAt ?? "?"}, rateLimited=${x.rateLimitedOrEmpty ?? "?"}`);
}

console.log("\n=== analytics_events sample (last 5) ===");
const events = await db.collection("analytics_events").orderBy("timestamp", "desc").limit(5).get();
for (const d of events.docs) {
    const x = d.data();
    const ts = x.timestamp?.toDate?.()?.toISOString?.()?.slice(0, 19) ?? "?";
    console.log(`  ${ts}  ${(x.event ?? "?").padEnd(30)} src=${x.source ?? "?"} uid=${x.user_id ?? "anon"}`);
}

console.log("\n=== feedback sample (last 3) ===");
const fb = await db.collection("feedback").orderBy("timestamp", "desc").limit(3).get();
console.log(`  total: ${fb.size} (showing latest 3)`);
for (const d of fb.docs) {
    const x = d.data();
    console.log(`  score=${x.score} comment="${(x.comment ?? "—").slice(0, 50)}" src=${x.source}`);
}

console.log("\n=== users sample: check createdAt type ===");
const users = await db.collection("users").limit(3).get();
for (const d of users.docs) {
    const x = d.data();
    const createdAtType = x.createdAt instanceof admin.default.firestore.Timestamp ? "Timestamp" : typeof x.createdAt;
    const lastLoginType = x.lastLogin instanceof admin.default.firestore.Timestamp ? "Timestamp" : typeof x.lastLogin;
    console.log(`  ${d.id.slice(0, 14)}...  createdAt=${createdAtType} (${typeof x.createdAt === "string" ? x.createdAt.slice(0, 25) : "?"})  lastLogin=${lastLoginType}  unsub=${x.unsubscribed ?? false}  drip=${x.drip_stalled_sent ?? false}`);
}

console.log("\n=== checking required composite indexes ===");
// Test queries that need composite indexes
try {
    await db.collection("analytics_events")
        .where("event", "==", "payment_succeeded")
        .orderBy("timestamp", "desc")
        .limit(1).get();
    console.log("  ✓ analytics_events (event, timestamp desc) — index exists");
} catch (e) {
    console.log(`  ✗ analytics_events (event, timestamp desc) — MISSING: ${e.message.slice(0, 100)}`);
}

try {
    await db.collection("feedback")
        .orderBy("timestamp", "desc")
        .limit(1).get();
    console.log("  ✓ feedback (timestamp desc) — index exists (auto)");
} catch (e) {
    console.log(`  ✗ feedback (timestamp desc) — MISSING: ${e.message.slice(0, 100)}`);
}

process.exit(0);
