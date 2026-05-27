#!/usr/bin/env node
/** Deep inspect what each completed user has in users/{uid}/data/* */
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

// All 24 real users (post cut-off) — but focus on the 4 with start_emails_generation triggered
// + noa.printemps who had customizations but no trigger
const TARGET_UIDS_FROM_LOGS = [
    "gPrv5gLgtIg2nzDXQh9Mdg2xK3P2",  // 06/05 Air France — hadidmassicila
    "u6GF5dC3WbVU338hiJo9nJP2Rwh2",  // 12/05 Hôtel Le Negresco — dupontenriquepro
    "IvkCyMZU8hVqTa3TPzeIyu5IDSI2",  // 17/05 SNCF — ademsadki93
    "34tLuZa3c9WATW5UdZmFKnWsZ2E2",  // 20/05 Delpharm — kxhailey
];

// Resolve emails
const userRecords = await Promise.all(TARGET_UIDS_FROM_LOGS.map(uid => auth.getUser(uid).catch(() => null)));

for (let i = 0; i < TARGET_UIDS_FROM_LOGS.length; i++) {
    const uid = TARGET_UIDS_FROM_LOGS[i];
    const email = userRecords[i]?.email ?? "?";
    console.log(`\n${"━".repeat(80)}`);
    console.log(`  ${email}  (${uid})`);
    console.log("━".repeat(80));

    // List all docs in the data sub-collection
    const dataCol = db.collection("users").doc(uid).collection("data");
    const dataDocs = await dataCol.listDocuments();
    console.log(`Sub-docs in data/: ${dataDocs.map(d => d.id).join(", ") || "(none)"}`);

    for (const docRef of dataDocs) {
        const snap = await docRef.get();
        if (!snap.exists) continue;
        const data = snap.data();
        const keys = Object.keys(data ?? {});
        console.log(`\n  📄 data/${docRef.id}  — fields: ${keys.join(", ")}`);

        if (docRef.id === "results") {
            // Inspect each result entry
            for (const [resultId, val] of Object.entries(data ?? {})) {
                if (typeof val !== "object" || val === null) {
                    console.log(`    ${resultId}: ${JSON.stringify(val)?.slice(0, 100)}`);
                    continue;
                }
                const subKeys = Object.keys(val);
                console.log(`    ${resultId}:`);
                console.log(`      company: ${JSON.stringify(val.company)?.slice(0, 100)}`);
                console.log(`      keys: ${subKeys.join(", ")}`);
                // If there are emails, count them
                if (Array.isArray(val.emails)) {
                    console.log(`      emails: ${val.emails.length} generate`);
                    for (const em of val.emails.slice(0, 2)) {
                        const subj = em.subject || em.title || "(no subject)";
                        console.log(`        - ${String(subj).slice(0, 80)}`);
                    }
                }
                if (val.recruiter) {
                    console.log(`      recruiter: ${JSON.stringify(val.recruiter)?.slice(0, 150)}`);
                }
                if (val.error) console.log(`      error: ${JSON.stringify(val.error)?.slice(0, 200)}`);
                if (val.status) console.log(`      status: ${val.status}`);
                if (val.recruiter_summary) console.log(`      has recruiter_summary: yes`);
                if (val.blog_articles) console.log(`      blog_articles: ${Array.isArray(val.blog_articles) ? val.blog_articles.length : "yes"}`);
            }
        } else if (docRef.id === "account") {
            // Just summarize, don't dump full account
            console.log(`    companies: ${(data?.companies ?? []).length}`);
            console.log(`    has cvUrl: ${!!data?.cvUrl}, profileSummary: ${!!data?.profileSummary}, customizations: ${!!data?.customizations}, queries: ${!!data?.queries}`);
        } else {
            console.log(`    sample: ${JSON.stringify(data)?.slice(0, 300)}`);
        }
    }

    // Also: any sub-collections of data/results?
    const resultsRef = dataCol.doc("results");
    const resultsSubcols = await resultsRef.listCollections().catch(() => []);
    if (resultsSubcols.length > 0) {
        console.log(`\n  Sub-collections under data/results: ${resultsSubcols.map(c => c.id).join(", ")}`);
    }
}

// Bonus: check "ids" top-level collection for entries pointing to these users
console.log(`\n\n${"━".repeat(80)}`);
console.log("  Cross-check: 'ids' collection entries for these users");
console.log("━".repeat(80));
for (const uid of TARGET_UIDS_FROM_LOGS) {
    const matches = await db.collection("ids").where("__name__", ">=", "0").get();
    let found = 0;
    for (const d of matches.docs) {
        if (d.id.includes(uid)) {
            found++;
            console.log(`  ${d.id}  →  ${JSON.stringify(d.data())}`);
        }
    }
}

process.exit(0);
