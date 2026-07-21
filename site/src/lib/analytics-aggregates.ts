import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export function analyticsDay(value: Date | Timestamp | string | number = new Date()): string {
  const date = value instanceof Timestamp
    ? value.toDate()
    : value instanceof Date
      ? value
      : new Date(value);
  return (Number.isFinite(date.getTime()) ? date : new Date()).toISOString().slice(0, 10);
}

export async function incrementDailyAnalytics(
  fields: Record<string, number>,
  value: Date | Timestamp | string | number = new Date(),
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  for (const [field, amount] of Object.entries(fields)) {
    updates[field] = FieldValue.increment(amount);
  }
  await adminDb.collection("analytics_daily").doc(analyticsDay(value)).set(updates, { merge: true });
}

export function metricKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 80) || "unknown";
}
