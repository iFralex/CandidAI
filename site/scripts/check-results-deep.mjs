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
const auth = admin.default.auth();

const TARGETS = [
    { uid: "gPrv5gLgtIg2nzDXQh9Mdg2xK3P2", resultId: "IjjYInFPmNv1SeLaHjFE" },
    { uid: "u6GF5dC3WbVU338hiJo9nJP2Rwh2", resultId: "T8aXTHpEe4ikdnDxbEzR" },
    { uid: "IvkCyMZU8hVqTa3TPzeIyu5IDSI2", resultId: "qIZw7FiivSDmu91BJZ1j" },
    { uid: "34tLuZa3c9WATW5UdZmFKnWsZ2E2", resultId: "UGtDw8C6pNEGqk7hkKfN" },
];

for (const { uid, resultId } of TARGETS) {
    const user = await auth.getUser(uid).catch(() => null);
    console.log(`\n${"━".repeat(80)}\n  ${user?.email}\n${"━".repeat(80)}`);

    // Read result entry directly
    const resultsSnap = await db.collection("users").doc(uid).collection("data").doc("results").get();
    const result = resultsSnap.data()?.[resultId];
    if (result) {
        console.log("RESULT (root):");
        console.log(`  company:     ${result.company?.name}`);
        console.log(`  start_date:  ${result.start_date?.toDate?.()?.toISOString?.()}`);
        console.log(`  email_sent:  ${JSON.stringify(result.email_sent)}`);
        console.log(`  recruiter:   ${JSON.stringify(result.recruiter)}`);
        console.log(`  blog_articles: ${Array.isArray(result.blog_articles) ? result.blog_articles.length + " articoli" : typeof result.blog_articles}`);
    }

    // Read emails doc
    const emailsSnap = await db.collection("users").doc(uid).collection("data").doc("emails").get();
    const email = emailsSnap.data()?.[resultId];
    if (email) {
        console.log(`\nEMAIL CONTENT (data/emails/${resultId}):`);
        console.log(`  subject:       ${email.subject}`);
        console.log(`  email_address: ${JSON.stringify(email.email_address)?.slice(0, 100)}`);
        console.log(`  body (200 char): ${String(email.body || email.html || email.text || "(no body)").slice(0, 200)}`);
        console.log(`  ALL KEYS: ${Object.keys(email).join(", ")}`);
    } else {
        console.log(`\n(no email doc for ${resultId})`);
    }

    // Read sub-collection of the result
    const subcolDocs = await db.collection("users").doc(uid)
        .collection("data").doc("results")
        .collection(resultId).listDocuments();
    console.log(`\nSub-collection data/results/${resultId}/: ${subcolDocs.length} docs → ${subcolDocs.map(d => d.id).join(", ")}`);
    for (const docRef of subcolDocs) {
        const snap = await docRef.get();
        const d = snap.data() || {};
        console.log(`  📄 ${docRef.id}:  keys = ${Object.keys(d).join(", ")}`);
        if (d.timestamp) console.log(`     timestamp: ${d.timestamp?.toDate?.()?.toISOString?.()}`);
        if (d.subject) console.log(`     subject: ${String(d.subject).slice(0, 100)}`);
        if (d.from) console.log(`     from: ${d.from}`);
        if (d.to) console.log(`     to: ${d.to}`);
        if (d.status) console.log(`     status: ${d.status}`);
    }
}
process.exit(0);
