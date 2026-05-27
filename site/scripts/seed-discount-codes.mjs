#!/usr/bin/env node
/**
 * Seed / update the Firestore `discount_codes` collection.
 *
 * Idempotent: re-running upserts but preserves used_count for codes that
 * already exist. Edit the SEED constant to add/change codes.
 *
 * Doc ID = code.toLowerCase() (the lookup key used by validateDiscountCode).
 * The `code` field on the doc keeps the canonical display case (WELCOME15).
 *
 * Run from site/:  node scripts/seed-discount-codes.mjs
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
admin.default.initializeApp({
    credential: admin.default.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
});
const db = admin.default.firestore();
const { FieldValue, Timestamp } = await import("firebase-admin/firestore");

/** Edit me to add/change codes. */
const SEED = [
    {
        code: "test",
        type: "fixed",
        value: 1,                  // 1 cent (Stripe minimum-bypass test)
        notes: "Dev test code — forces near-free path",
        enabled: true,
        expires_at: null,
        max_uses: null,
    },
    {
        code: "free",
        type: "percentage",
        value: 100,
        notes: "Internal: 100% off, bypasses Stripe entirely",
        enabled: true,
        expires_at: null,
        max_uses: null,
    },
    {
        code: "WELCOME15",
        type: "percentage",
        value: 15,
        notes: "Issued by day-14 onboarding-sequence upgrade_offer email",
        enabled: true,
        expires_at: null,
        max_uses: null,
    },
    {
        code: "MERCI15",
        type: "percentage",
        value: 15,
        notes: "Issued in the manual outreach campaign drafts (FR users)",
        enabled: true,
        expires_at: null,
        max_uses: null,
    },
];

let upserted = 0;
let preserved = 0;
for (const seed of SEED) {
    const docId = seed.code.toLowerCase();
    const ref = db.collection("discount_codes").doc(docId);
    const existing = await ref.get();
    const payload = {
        code: seed.code,                // display case preserved
        type: seed.type,
        value: seed.value,
        enabled: seed.enabled,
        expires_at: seed.expires_at,
        max_uses: seed.max_uses,
        notes: seed.notes,
        updated_at: FieldValue.serverTimestamp(),
    };
    if (existing.exists) {
        // Preserve used_count and created_at on update
        await ref.update(payload);
        preserved++;
        console.log(`  ↻ updated ${seed.code} (used_count preserved: ${existing.data()?.used_count ?? 0})`);
    } else {
        await ref.set({
            ...payload,
            used_count: 0,
            created_at: FieldValue.serverTimestamp(),
        });
        upserted++;
        console.log(`  ✓ created ${seed.code}`);
    }
}

console.log(`\nDone. ${upserted} new, ${preserved} updated. Total seeded: ${SEED.length}`);
process.exit(0);
