import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type CommunicationCategory = "transactional" | "operational" | "onboarding" | "marketing";

const MARKETING_COOLDOWN_MS = 48 * 60 * 60 * 1000;

export async function reserveCommunication(args: {
  userId: string;
  dedupeKey: string;
  type: string;
  category: CommunicationCategory;
  metadata?: Record<string, unknown>;
}): Promise<{ send: boolean; reason?: string }> {
  const userRef = adminDb.collection("users").doc(args.userId);
  const communicationRef = userRef.collection("communications").doc(args.dedupeKey);
  const settingsRef = userRef.collection("data").doc("settings");

  return adminDb.runTransaction(async tx => {
    const [userSnap, communicationSnap, settingsSnap] = await Promise.all([
      tx.get(userRef), tx.get(communicationRef), tx.get(settingsRef),
    ]);
    const existing = communicationSnap.data();
    const startedMs = existing?.startedAt instanceof Timestamp ? existing.startedAt.toMillis() : Date.parse(String(existing?.startedAt ?? ""));
    const activeLease = existing?.status === "sending" && Number.isFinite(startedMs) && Date.now() - startedMs < 10 * 60_000;
    if (existing?.status === "sent" || activeLease) {
      return { send: false, reason: "duplicate" };
    }

    const user = userSnap.data() ?? {};
    const preferences = settingsSnap.data()?.preferences ?? {};
    if ((args.category === "marketing" || args.category === "onboarding") && user.unsubscribed === true) {
      return { send: false, reason: "unsubscribed" };
    }
    if (args.category === "onboarding" && preferences.onboardingReminders === false) {
      return { send: false, reason: "preference" };
    }
    if (args.category === "marketing" && (preferences.marketing === false || preferences.marketingEmails === false)) {
      return { send: false, reason: "preference" };
    }

    const lastMarketing = user.lastLifecycleEmailSentAt;
    const lastMarketingMs = lastMarketing instanceof Timestamp
      ? lastMarketing.toMillis()
      : Date.parse(String(lastMarketing ?? ""));
    if ((args.category === "marketing" || args.category === "onboarding")
      && Number.isFinite(lastMarketingMs)
      && Date.now() - lastMarketingMs < MARKETING_COOLDOWN_MS) {
      return { send: false, reason: "cooldown" };
    }

    tx.set(communicationRef, {
      type: args.type,
      category: args.category,
      status: "sending",
      attempts: FieldValue.increment(1),
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      metadata: args.metadata ?? {},
    }, { merge: true });
    return { send: true };
  });
}

export async function completeCommunication(args: {
  userId: string;
  dedupeKey: string;
  category: CommunicationCategory;
  type?: string;
  providerId?: string | null;
}): Promise<void> {
  const userRef = adminDb.collection("users").doc(args.userId);
  const communicationRef = userRef.collection("communications").doc(args.dedupeKey);
  const batch = adminDb.batch();
  const eventRef = adminDb.collection("analytics_events").doc();
  batch.set(communicationRef, {
    status: "sent",
    providerId: args.providerId ?? null,
    sentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastError: FieldValue.delete(),
  }, { merge: true });
  if (args.category === "marketing" || args.category === "onboarding") {
    batch.set(userRef, { lastLifecycleEmailSentAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  batch.set(eventRef, {
    event: "communication_sent",
    params: { type: args.type ?? "unknown", category: args.category, dedupe_key: args.dedupeKey },
    user_id: args.userId,
    session_id: null,
    page_path: null,
    timestamp: FieldValue.serverTimestamp(),
    source: "server",
  });
  await batch.commit();
}

export async function failCommunication(args: {
  userId: string;
  dedupeKey: string;
  error: unknown;
}): Promise<void> {
  const communicationRef = adminDb.collection("users").doc(args.userId).collection("communications").doc(args.dedupeKey);
  const eventRef = adminDb.collection("analytics_events").doc();
  const batch = adminDb.batch();
  batch.set(communicationRef, {
    status: "failed",
    lastError: String(args.error).slice(0, 500),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(eventRef, {
    event: "communication_failed",
    params: { dedupe_key: args.dedupeKey, error: String(args.error).slice(0, 300) },
    user_id: args.userId,
    session_id: null,
    page_path: null,
    timestamp: FieldValue.serverTimestamp(),
    source: "server",
  });
  await batch.commit();
}

export async function cancelPendingOnboardingCommunications(userId: string, reason: string): Promise<void> {
  const snap = await adminDb.collection("users").doc(userId).collection("communications")
    .where("category", "==", "onboarding")
    .get();
  const cancellable = snap.docs.filter(doc => ["pending", "failed"].includes(String(doc.data().status)));
  if (!cancellable.length) return;
  const batch = adminDb.batch();
  cancellable.forEach(doc => batch.set(doc.ref, {
    status: "cancelled",
    cancelReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }));
  await batch.commit();
}
