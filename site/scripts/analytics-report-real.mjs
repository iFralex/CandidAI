#!/usr/bin/env node
/**
 * Real-users-only analytics report.
 * Cut-off: 2026-05-04 (first verified real signup after test/spam phase).
 */
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
const { BetaAnalyticsDataClient } = await import("@google-analytics/data");

admin.default.initializeApp({
    credential: admin.default.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
});
const auth = admin.default.auth();
const db = admin.default.firestore();

const ga = new BetaAnalyticsDataClient({
    credentials: {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
});
const PROPERTY = `properties/${process.env.GA4_PROPERTY_ID}`;

const CUTOFF_DATE = "2026-05-04";
const CUTOFF = new Date(CUTOFF_DATE + "T00:00:00Z");
const RANGE = { startDate: CUTOFF_DATE, endDate: "today" };

async function runReport(req) {
    const [res] = await ga.runReport({ property: PROPERTY, ...req });
    const rows = (res.rows ?? []).map((r) => ({
        d: (r.dimensionValues ?? []).map((v) => v.value ?? ""),
        m: (r.metricValues ?? []).map((v) => v.value ?? "0"),
    }));
    let totals = (res.totals?.[0]?.metricValues ?? []).map((v) => v.value ?? "0");
    if (totals.length === 0 && rows.length === 1 && !req.dimensions) totals = rows[0].m;
    return { rows, totals };
}
async function tryRun(name, req) {
    try { return await runReport(req); } catch (e) { console.log(`  (errore ${name}: ${e.message?.slice(0, 150)})`); return { rows: [], totals: [] }; }
}

function section(t) { console.log(`\n${"━".repeat(80)}\n  ${t}\n${"━".repeat(80)}`); }

console.log(`Cut-off: dal ${CUTOFF_DATE} a oggi (solo utenti reali)\n`);

// ── GA4 KPI ─────────────────────────────────────────────────────────────────
section("GA4 · KPI");
const kpis = await runReport({
    dateRanges: [RANGE],
    metrics: [
        { name: "activeUsers" }, { name: "newUsers" }, { name: "totalUsers" },
        { name: "sessions" }, { name: "screenPageViews" }, { name: "eventCount" },
        { name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "engagementRate" },
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

// ── Trend ───────────────────────────────────────────────────────────────────
section("GA4 · TREND GIORNALIERO");
const trend = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "newUsers" }, { name: "eventCount" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
});
console.log("date       users sess  new events");
for (const r of trend.rows) {
    const d = r.d[0];
    console.log(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}  ${r.m[0].padStart(5)} ${r.m[1].padStart(4)} ${r.m[2].padStart(4)} ${r.m[3].padStart(6)}`);
}

// ── Top events ──────────────────────────────────────────────────────────────
section("GA4 · TOP EVENTI");
const events = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    limit: 50,
});
console.log("count   users  event");
for (const r of events.rows) console.log(`${r.m[0].padStart(6)} ${r.m[1].padStart(6)}  ${r.d[0]}`);

// ── Top pages ───────────────────────────────────────────────────────────────
section("GA4 · TOP PAGINE");
const pages = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "averageSessionDuration" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 25,
});
console.log("views  users   avgDur  path");
for (const r of pages.rows) console.log(`${r.m[0].padStart(5)} ${r.m[1].padStart(5)}  ${Number(r.m[2]).toFixed(0).padStart(5)}s  ${r.d[0]}`);

// ── Sources ─────────────────────────────────────────────────────────────────
section("GA4 · ACQUISIZIONE");
const sources = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 20,
});
console.log("sess  users  new  source / medium");
for (const r of sources.rows) console.log(`${r.m[0].padStart(4)} ${r.m[1].padStart(5)} ${r.m[2].padStart(4)}  ${r.d[0] || "(direct)"} / ${r.d[1] || "(none)"}`);

// ── Geo ─────────────────────────────────────────────────────────────────────
section("GA4 · PAESE + DEVICE + LINGUA");
const geo = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "country" }, { name: "deviceCategory" }, { name: "language" }],
    metrics: [{ name: "totalUsers" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    limit: 25,
});
console.log("users sess  country / device / lang");
for (const r of geo.rows) console.log(`${r.m[0].padStart(5)} ${r.m[1].padStart(4)}  ${r.d[0]} / ${r.d[1]} / ${r.d[2]}`);

// ── Landing pages ───────────────────────────────────────────────────────────
section("GA4 · LANDING PAGES (prima pagina visitata)");
const landings = await tryRun("landings", {
    dateRanges: [RANGE],
    dimensions: [{ name: "landingPage" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "bounceRate" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 15,
});
console.log("sess users  bounce  landing");
for (const r of landings.rows) console.log(`${r.m[0].padStart(4)} ${r.m[1].padStart(5)}  ${(Number(r.m[2])*100).toFixed(0).padStart(4)}%   ${r.d[0]}`);

// ── Funnel ──────────────────────────────────────────────────────────────────
section("GA4 · FUNNEL");
const funnel = await runReport({
    dateRanges: [RANGE],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
    dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: [
        "page_view", "landing_cta_click", "landing_pricing_section_view", "landing_plan_click",
        "login_attempt", "login_success", "signup_attempt", "signup_success",
        "onboarding_step_view", "onboarding_step_complete", "onboarding_plan_select", "onboarding_file_upload",
        "onboarding_company_add", "onboarding_complete",
        "dashboard_view", "company_confirm", "email_send",
        "checkout_open", "checkout_submit", "checkout_success", "checkout_error", "checkout_free_success",
    ]}}},
});
const order = [
    "page_view", "landing_cta_click", "landing_pricing_section_view", "landing_plan_click",
    "signup_attempt", "signup_success",
    "onboarding_step_view", "onboarding_step_complete", "onboarding_plan_select",
    "onboarding_file_upload", "onboarding_company_add", "onboarding_complete",
    "dashboard_view", "company_confirm", "email_send",
    "checkout_open", "checkout_submit", "checkout_success", "checkout_free_success", "checkout_error",
    "login_attempt", "login_success",
];
const byName = Object.fromEntries(funnel.rows.map((r) => [r.d[0], r.m]));
console.log("users  events  step");
for (const name of order) {
    const m = byName[name];
    if (!m) { console.log(`     0       0  ${name}`); continue; }
    console.log(`${m[1].padStart(5)} ${m[0].padStart(7)}  ${name}`);
}

// ── Firebase Auth: real users ───────────────────────────────────────────────
section("FIREBASE AUTH · UTENTI REALI (dal " + CUTOFF_DATE + ")");
let all = [];
let next;
do { const p = await auth.listUsers(1000, next); all.push(...p.users); next = p.pageToken; } while (next);
const real = all.filter((u) => new Date(u.metadata.creationTime) >= CUTOFF);
console.log(`Utenti reali: ${real.length} (su ${all.length} totali in Auth)`);
console.log(`Email verificate: ${real.filter(u => u.emailVerified).length}/${real.length}`);

const realByUid = new Map(real.map((u) => [u.uid, u]));

console.log("\nLista cronologica:");
console.log("created              lastSignIn           verified  email");
for (const u of [...real].sort((a, b) => new Date(a.metadata.creationTime) - new Date(b.metadata.creationTime))) {
    const c = u.metadata.creationTime?.slice(0, 19).replace("T", " ") ?? "?";
    const l = u.metadata.lastSignInTime?.slice(0, 19).replace("T", " ") ?? "?";
    const v = u.emailVerified ? "yes" : "no ";
    const back = new Date(u.metadata.lastSignInTime).getTime() !== new Date(u.metadata.creationTime).getTime() ? "←ritorno" : "";
    console.log(`${c}  ${l}  ${v}     ${u.email}  ${back}`);
}

const returning = real.filter(u => new Date(u.metadata.lastSignInTime).getTime() > new Date(u.metadata.creationTime).getTime() + 60_000);
console.log(`\n→ Utenti che sono tornati almeno una volta dopo signup: ${returning.length}/${real.length} (${((returning.length/real.length)*100).toFixed(0)}%)`);

// ── Firestore: users docs for real users ────────────────────────────────────
section("FIRESTORE · users (solo reali)");
try {
    const docs = await Promise.all(real.map((u) => db.collection("users").doc(u.uid).get()));
    const found = docs.filter((d) => d.exists);
    console.log(`Doc Firestore per utenti reali: ${found.length}/${real.length}`);

    const planCounts = {}, fields = new Set();
    let onboardingDone = 0, onboardingPartial = 0, hasCompanies = 0, totalCompanies = 0;
    const stepDistrib = {};
    for (const d of found) {
        const u = d.data();
        Object.keys(u).forEach((k) => fields.add(k));
        const plan = u.plan ?? "(none)";
        planCounts[plan] = (planCounts[plan] ?? 0) + 1;
        const step = u.onboardingStep;
        if (step !== undefined) stepDistrib[step] = (stepDistrib[step] ?? 0) + 1;
        if (u.onboardingCompleted === true || step === -1) onboardingDone++;
        else if (step > 0) onboardingPartial++;
        if (Array.isArray(u.companies) && u.companies.length > 0) { hasCompanies++; totalCompanies += u.companies.length; }
    }
    console.log(`\nCampi trovati: ${[...fields].join(", ")}`);
    console.log("\nDistribuzione plan (utenti reali):");
    for (const [p, c] of Object.entries(planCounts).sort((a, b) => b[1] - a[1])) console.log(`  ${p.padEnd(20)} ${c}`);

    console.log("\nDistribuzione onboardingStep:");
    for (const [s, c] of Object.entries(stepDistrib).sort((a, b) => Number(a[0]) - Number(b[0]))) console.log(`  step ${s}: ${c} utenti`);
    console.log(`Onboarding completato: ${onboardingDone}`);
    console.log(`Onboarding parziale:   ${onboardingPartial}`);
    console.log(`Utenti con companies aggiunte: ${hasCompanies} (totale companies: ${totalCompanies})`);

    // Dump compact per-user
    console.log("\nDettaglio per utente (top 30 per createdAt desc):");
    const sorted = found.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
    });
    for (const u of sorted.slice(0, 30)) {
        const authU = realByUid.get(u.uid);
        const email = authU?.email ?? "?";
        const created = u.createdAt?.toDate?.()?.toISOString?.().slice(0, 10) ?? "?";
        const plan = u.plan ?? "?";
        const step = u.onboardingStep ?? "-";
        const credits = u.credits ?? 0;
        const cies = Array.isArray(u.companies) ? u.companies.length : 0;
        console.log(`  ${created}  ${plan.padEnd(10)} step=${String(step).padStart(2)} cr=${String(credits).padStart(4)} comp=${cies}  ${email}`);
    }
} catch (e) {
    console.log(`(errore: ${e.message})`);
}

// ── Firestore: analytics_events for real users ──────────────────────────────
section("FIRESTORE · analytics_events (post cut-off)");
try {
    const realUids = new Set(real.map((u) => u.uid));
    const snap = await db.collection("analytics_events")
        .where("timestamp", ">=", admin.default.firestore.Timestamp.fromDate(CUTOFF))
        .orderBy("timestamp", "desc")
        .get();
    console.log(`Eventi post ${CUTOFF_DATE}: ${snap.size}`);

    const byEv = {}, byUserKnown = {}, errorMessages = {};
    for (const d of snap.docs) {
        const e = d.data();
        byEv[e.event] = (byEv[e.event] ?? 0) + 1;
        if (e.user_id && realUids.has(e.user_id)) byUserKnown[e.user_id] = (byUserKnown[e.user_id] ?? 0) + 1;
        if (e.event === "app_error" && e.params?.error_message) {
            const msg = String(e.params.error_message).slice(0, 100);
            errorMessages[msg] = (errorMessages[msg] ?? 0) + 1;
        }
    }
    console.log("\nPer evento:");
    for (const [k, v] of Object.entries(byEv).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(30)} ${v}`);

    if (Object.keys(errorMessages).length > 0) {
        console.log("\nTop app_error messages:");
        for (const [m, c] of Object.entries(errorMessages).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
            console.log(`  [${c}] ${m}`);
        }
    }
} catch (e) {
    console.log(`(errore: ${e.message})`);
}

console.log("\n✓ Done.");
process.exit(0);
