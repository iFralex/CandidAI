#!/usr/bin/env node
/** Verify companies are stored in users/{uid}/data/account.companies (not on user doc). */
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
const db = admin.default.firestore();

const CUTOFF = new Date("2026-05-04T00:00:00Z");

// Get real users
let all = [];
let next;
do { const p = await auth.listUsers(1000, next); all.push(...p.users); next = p.pageToken; } while (next);
const real = all.filter((u) => new Date(u.metadata.creationTime) >= CUTOFF);

console.log(`Real users (post cut-off): ${real.length}\n`);

// Fetch account sub-doc for each
const results = await Promise.all(real.map(async (u) => {
    const accountSnap = await db.collection("users").doc(u.uid).collection("data").doc("account").get();
    const data = accountSnap.exists ? accountSnap.data() : null;
    return { email: u.email, uid: u.uid, exists: accountSnap.exists, data };
}));

let withAccount = 0, withCompanies = 0, totalCompanies = 0, withProfileSummary = 0, withCvUrl = 0, withCustomizations = 0;
const companyList = [];
const fieldsSeen = new Set();
for (const r of results) {
    if (!r.exists) continue;
    withAccount++;
    if (r.data) Object.keys(r.data).forEach((k) => fieldsSeen.add(k));
    if (Array.isArray(r.data?.companies) && r.data.companies.length > 0) {
        withCompanies++;
        totalCompanies += r.data.companies.length;
        companyList.push({ email: r.email, count: r.data.companies.length, names: r.data.companies.map(c => c.name || c.domain) });
    }
    if (r.data?.profileSummary) withProfileSummary++;
    if (r.data?.cvUrl) withCvUrl++;
    if (r.data?.customizations) withCustomizations++;
}

console.log(`Users with account sub-doc: ${withAccount}/${real.length}`);
console.log(`Users with companies:       ${withCompanies}`);
console.log(`Total companies saved:      ${totalCompanies}`);
console.log(`Users with profileSummary:  ${withProfileSummary}`);
console.log(`Users with cvUrl:           ${withCvUrl}`);
console.log(`Users with customizations:  ${withCustomizations}`);
console.log(`\nFields seen in account sub-doc: ${[...fieldsSeen].join(", ")}`);

if (companyList.length > 0) {
    console.log("\nUsers with companies (detail):");
    for (const c of companyList) {
        console.log(`  ${c.email}: [${c.count}] ${c.names.join(", ")}`);
    }
}

// Detailed per-user timeline: who reached which onboarding stage and WHEN
console.log("\n\n=== ONBOARDING TIMELINE (real users) ===");
const realByUid = new Map(real.map((u) => [u.uid, u]));
const rows = [];
for (const r of results) {
    const u = realByUid.get(r.uid);
    rows.push({
        email: r.email,
        signup: u?.metadata?.creationTime ?? "?",
        lastLogin: u?.metadata?.lastSignInTime ?? "?",
        hasAccount: r.exists,
        companies: Array.isArray(r.data?.companies) ? r.data.companies.length : 0,
        cv: !!r.data?.cvUrl,
        profile: !!r.data?.profileSummary,
        custom: !!r.data?.customizations,
    });
}
rows.sort((a, b) => new Date(a.signup) - new Date(b.signup));
console.log("signup_date           lastLogin             acc cv prof cust  comp  email");
for (const r of rows) {
    const s = r.signup.slice(0, 19).replace("T", " ");
    const l = r.lastLogin.slice(0, 19).replace("T", " ");
    console.log(`${s}  ${l}  ${r.hasAccount ? "Y" : "-"}   ${r.cv ? "Y" : "-"}  ${r.profile ? "Y" : "-"}    ${r.custom ? "Y" : "-"}     ${String(r.companies).padStart(2)}    ${r.email}`);
}

console.log("\n\n=== KEY DATES (users with customizations = step 5+) ===");
for (const r of rows.filter(x => x.custom)) {
    console.log(`  ${r.signup.slice(0, 10)} → last activity ${r.lastLogin.slice(0, 10)}  ·  ${r.email}`);
}

process.exit(0);
