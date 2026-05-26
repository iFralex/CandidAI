#!/usr/bin/env node
/**
 * One-shot analytics report.
 * Pulls data from: GA4 Data API + Firebase Auth + Firestore.
 * Run from site/: node scripts/analytics-report.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Load .env.local manually ────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env.local");
const envText = fs.readFileSync(envPath, "utf8");
for (const line of envText.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
}

const admin = await import("firebase-admin");
const { BetaAnalyticsDataClient } = await import("@google-analytics/data");

// ── Init Firebase Admin ─────────────────────────────────────────────────────
admin.default.initializeApp({
    credential: admin.default.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
});
const auth = admin.default.auth();
const db = admin.default.firestore();

// ── Init GA Data API ────────────────────────────────────────────────────────
const ga = new BetaAnalyticsDataClient({
    credentials: {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
});
const PROPERTY = `properties/${process.env.GA4_PROPERTY_ID}`;

const RANGE = { startDate: "30daysAgo", endDate: "today" };

async function runReport(req) {
    const [res] = await ga.runReport({ property: PROPERTY, ...req });
    const rows = (res.rows ?? []).map((r) => ({
        d: (r.dimensionValues ?? []).map((v) => v.value ?? ""),
        m: (r.metricValues ?? []).map((v) => v.value ?? "0"),
    }));
    // When no dimensions are requested, the single result row IS the totals.
    let totals = (res.totals?.[0]?.metricValues ?? []).map((v) => v.value ?? "0");
    if (totals.length === 0 && rows.length === 1 && !req.dimensions) {
        totals = rows[0].m;
    }
    return { rows, totals };
}

async function tryRun(name, req) {
    try { return await runReport(req); }
    catch (e) { console.log(`  (errore "${name}": ${e.message?.slice(0, 200)})`); return { rows: [], totals: [] }; }
}

// ── Section helper ──────────────────────────────────────────────────────────
function section(title) { console.log(`\n${"━".repeat(80)}\n  ${title}\n${"━".repeat(80)}`); }

// ── 1. GA4 KPIs ─────────────────────────────────────────────────────────────
section("GA4 · KPI ULTIMI 30 GIORNI");
const kpis = await runReport({
    dateRanges: [RANGE],
    metrics: [
        { name: "activeUsers" }, { name: "newUsers" }, { name: "totalUsers" },
        { name: "sessions" }, { name: "screenPageViews" }, { name: "eventCount" },
        { name: "averageSessionDuration" }, { name: "bounceRate" },
        { name: "engagementRate" },
    ],
});
const [au, nu, tu, ses, pv, ec, asd, br, er] = kpis.totals;
console.log(`Utenti attivi:        ${au}`);
console.log(`Nuovi utenti:         ${nu}`);
console.log(`Utenti totali:        ${tu}`);
console.log(`Sessioni:             ${ses}`);
console.log(`Page views:           ${pv}`);
console.log(`Eventi totali:        ${ec}`);
console.log(`Durata media sess:    ${Number(asd).toFixed(1)}s`);
console.log(`Bounce rate:          ${(Number(br) * 100).toFixed(1)}%`);
console.log(`Engagement rate:      ${(Number(er) * 100).toFixed(1)}%`);

// ── 2. GA4 daily trend ──────────────────────────────────────────────────────
section("GA4 · TREND GIORNALIERO (utenti attivi)");
const trend = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "newUsers" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
    limit: 365,
});
console.log("date       users sess  new");
for (const r of trend.rows) {
    const d = r.d[0];
    const date = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
    console.log(`${date}  ${r.m[0].padStart(5)} ${r.m[1].padStart(4)} ${r.m[2].padStart(4)}`);
}

// ── 3. GA4 top events ───────────────────────────────────────────────────────
section("GA4 · TOP EVENTI");
const events = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 50,
});
console.log("count   users  event");
for (const r of events.rows) {
    console.log(`${r.m[0].padStart(6)} ${r.m[1].padStart(6)}  ${r.d[0]}`);
}

// ── 4. GA4 top pages ────────────────────────────────────────────────────────
section("GA4 · TOP PAGINE");
const pages = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "averageSessionDuration" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 25,
});
console.log("views  users   avgDur  path");
for (const r of pages.rows) {
    console.log(`${r.m[0].padStart(5)} ${r.m[1].padStart(5)}  ${Number(r.m[2]).toFixed(0).padStart(5)}s  ${r.d[0]}`);
}

// ── 5. GA4 acquisition sources ──────────────────────────────────────────────
section("GA4 · SORGENTI DI ACQUISIZIONE");
const sources = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 20,
});
console.log("sess  users  new  source / medium");
for (const r of sources.rows) {
    console.log(`${r.m[0].padStart(4)} ${r.m[1].padStart(5)} ${r.m[2].padStart(4)}  ${r.d[0] || "(direct)"} / ${r.d[1] || "(none)"}`);
}

// ── 6. GA4 country + device ─────────────────────────────────────────────────
section("GA4 · PAESE + DEVICE");
const geo = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "country" }, { name: "deviceCategory" }],
    metrics: [{ name: "totalUsers" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    limit: 20,
});
console.log("users  sess  country / device");
for (const r of geo.rows) {
    console.log(`${r.m[0].padStart(5)} ${r.m[1].padStart(5)}  ${r.d[0]} / ${r.d[1]}`);
}

// ── 7. GA4 per-user journey (top users by event count) ──────────────────────
section("GA4 · TOP UTENTI (per eventCount, anonimizzati)");
const userTotals = await tryRun("topUsers", {
    dateRanges: [RANGE],
    dimensions: [{ name: "userPseudoId" }],
    metrics: [{ name: "eventCount" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 15,
});
console.log("events   pseudoId");
for (const r of userTotals.rows) {
    console.log(`${r.m[0].padStart(6)}   ${r.d[0]}`);
}

// Per-user journey: top users + their event sequence
section("GA4 · PERCORSO TOP UTENTI (top 10 pseudoId × eventName)");
const topPseudo = userTotals.rows.slice(0, 10).map((r) => r.d[0]);
if (topPseudo.length > 0) {
    const journey = await tryRun("journey", {
        dateRanges: [RANGE],
        dimensions: [{ name: "userPseudoId" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
            filter: { fieldName: "userPseudoId", inListFilter: { values: topPseudo } },
        },
        orderBys: [
            { dimension: { dimensionName: "userPseudoId" } },
            { metric: { metricName: "eventCount" }, desc: true },
        ],
        limit: 500,
    });
    const grouped = {};
    for (const r of journey.rows) {
        (grouped[r.d[0]] ??= []).push(`${r.d[1]}(${r.m[0]})`);
    }
    for (const [uid, ev] of Object.entries(grouped)) {
        console.log(`\n  ${uid}:`);
        console.log(`    ${ev.slice(0, 12).join(" → ")}`);
    }
}

// ── 8. GA4 funnel ───────────────────────────────────────────────────────────
section("GA4 · FUNNEL CONVERSIONI");
const funnel = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    dimensionFilter: {
        filter: {
            fieldName: "eventName",
            inListFilter: {
                values: [
                    "page_view", "landing_cta_click", "login_attempt", "login_success",
                    "signup_attempt", "signup_success", "onboarding_complete",
                    "checkout_open", "checkout_submit", "checkout_success",
                    "checkout_error", "email_send", "app_download_click",
                    "company_confirm", "credits_used",
                ],
            },
        },
    },
});
const order = [
    "page_view", "landing_cta_click", "login_attempt", "login_success",
    "signup_attempt", "signup_success", "onboarding_complete",
    "checkout_open", "checkout_submit", "checkout_success", "checkout_error",
    "company_confirm", "email_send", "credits_used", "app_download_click",
];
const byName = Object.fromEntries(funnel.rows.map((r) => [r.d[0], r.m]));
console.log("users  events  step");
for (const name of order) {
    const m = byName[name];
    if (!m) { console.log(`     0       0  ${name}`); continue; }
    console.log(`${m[1].padStart(5)} ${m[0].padStart(7)}  ${name}`);
}

// ── 9. Firebase Auth users ──────────────────────────────────────────────────
section("FIREBASE AUTH · UTENTI");
let allUsers = [];
let next;
do {
    const page = await auth.listUsers(1000, next);
    allUsers.push(...page.users);
    next = page.pageToken;
} while (next);
console.log(`Totale utenti registrati: ${allUsers.length}`);
const verified = allUsers.filter((u) => u.emailVerified).length;
console.log(`Email verificate:         ${verified} (${((verified/allUsers.length)*100).toFixed(1)}%)`);
const providers = {};
for (const u of allUsers) {
    for (const p of u.providerData) providers[p.providerId] = (providers[p.providerId] ?? 0) + 1;
}
console.log("Provider auth:");
for (const [k, v] of Object.entries(providers)) console.log(`  ${k.padEnd(20)} ${v}`);

const last30 = allUsers
    .filter((u) => new Date(u.metadata.creationTime) > new Date(Date.now() - 30 * 86400_000));
console.log(`Nuovi utenti ultimi 30gg: ${last30.length}`);

console.log("\nUltimi 20 signup:");
const recent = [...allUsers].sort((a, b) => new Date(b.metadata.creationTime) - new Date(a.metadata.creationTime)).slice(0, 20);
console.log("created             lastSignIn          verified  email");
for (const u of recent) {
    const c = u.metadata.creationTime?.slice(0, 19).replace("T", " ") ?? "?";
    const l = u.metadata.lastSignInTime?.slice(0, 19).replace("T", " ") ?? "?";
    const v = u.emailVerified ? "yes" : "no ";
    console.log(`${c}  ${l}  ${v}      ${u.email ?? "(no email)"}`);
}

// ── 10. Firestore: users collection ─────────────────────────────────────────
section("FIRESTORE · users collection");
try {
    const usersSnap = await db.collection("users").get();
    console.log(`Documenti users totali: ${usersSnap.size}`);

    const planCounts = {}, creditsByPlan = {};
    let totalCredits = 0;
    for (const doc of usersSnap.docs) {
        const u = doc.data();
        const plan = u.plan ?? u.subscription?.plan ?? "(none)";
        planCounts[plan] = (planCounts[plan] ?? 0) + 1;
        const c = Number(u.credits ?? 0);
        creditsByPlan[plan] = (creditsByPlan[plan] ?? 0) + c;
        totalCredits += c;
    }
    console.log("\nDistribuzione per plan:");
    for (const [p, c] of Object.entries(planCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${p.padEnd(20)} ${String(c).padStart(4)} utenti  · ${creditsByPlan[p]} crediti totali`);
    }
    console.log(`\nCrediti totali nel sistema: ${totalCredits}`);

    // Sample top 5 users by some interesting fields
    console.log("\nCampi presenti su un sample (primo doc):");
    if (usersSnap.docs[0]) {
        const sample = usersSnap.docs[0].data();
        console.log(`  ${Object.keys(sample).join(", ")}`);
    }
} catch (e) {
    console.log(`(errore: ${e.message})`);
}

// ── 11. Firestore: analytics_events collection ──────────────────────────────
section("FIRESTORE · analytics_events (eventi critici persistiti)");
try {
    const evSnap = await db.collection("analytics_events").orderBy("timestamp", "desc").limit(500).get();
    console.log(`Eventi recenti recuperati: ${evSnap.size}`);

    const byEvent = {};
    const byUser = {};
    let withUser = 0;
    for (const doc of evSnap.docs) {
        const e = doc.data();
        byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
        if (e.user_id) { withUser++; byUser[e.user_id] = (byUser[e.user_id] ?? 0) + 1; }
    }
    console.log("\nPer tipo evento:");
    for (const [k, v] of Object.entries(byEvent).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k.padEnd(30)} ${v}`);
    }
    console.log(`\nEventi con user_id: ${withUser}/${evSnap.size}`);
    console.log("Top utenti per eventi critici:");
    for (const [uid, c] of Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        console.log(`  ${uid} → ${c} eventi`);
    }

    console.log("\nUltimi 30 eventi:");
    console.log("timestamp                 user_id                              event");
    for (const doc of evSnap.docs.slice(0, 30)) {
        const e = doc.data();
        const ts = e.timestamp?.toDate?.()?.toISOString?.().slice(0, 19) ?? "?";
        console.log(`${ts.padEnd(20)}  ${String(e.user_id ?? "anon").padEnd(30)}  ${e.event}`);
    }
} catch (e) {
    console.log(`(errore: ${e.message})`);
}

// ── 12. Firestore: list all top-level collections ───────────────────────────
section("FIRESTORE · tutte le collection top-level");
try {
    const cols = await db.listCollections();
    for (const c of cols) {
        const snap = await c.count().get();
        console.log(`  ${c.id.padEnd(30)} ${snap.data().count} docs`);
    }
} catch (e) {
    console.log(`(errore: ${e.message})`);
}

console.log("\n✓ Done.");
process.exit(0);
