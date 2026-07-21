import { NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { analyticsDay, metricKey } from "@/lib/analytics-aggregates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_EVENTS = new Set([
  "email.sent", "email.delivered", "email.delivery_delayed", "email.complained",
  "email.bounced", "email.opened", "email.clicked", "email.failed", "email.suppressed",
]);
const STATUS_RANK: Record<string, number> = {
  sent: 1, delivery_delayed: 2, delivered: 3, opened: 4, clicked: 5,
  failed: 6, suppressed: 6, bounced: 6, complained: 7,
};

type ResendEmailEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    subject?: string;
    click?: { link?: string };
    bounce?: { message?: string; type?: string; subType?: string };
  };
};

export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!webhookSecret || !id || !timestamp || !signature) {
    return new NextResponse("Missing webhook configuration or signature", { status: 400 });
  }

  let event: ResendEmailEvent;
  try {
    const payload = await req.text();
    event = resend.webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret }) as ResendEmailEvent;
  } catch {
    return new NextResponse("Invalid webhook", { status: 400 });
  }

  if (!EMAIL_EVENTS.has(event.type) || !event.data?.email_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const eventData = event.data;
  const emailId = eventData.email_id!;
  const status = event.type.replace("email.", "");
  const occurredDate = new Date(event.created_at ?? Date.now());
  const occurredAt = Timestamp.fromDate(Number.isFinite(occurredDate.getTime()) ? occurredDate : new Date());
  const webhookRef = adminDb.collection("resend_webhook_events").doc(id);
  const indexRef = adminDb.collection("email_provider_index").doc(emailId);
  const dailyRef = adminDb.collection("analytics_daily").doc(analyticsDay(occurredAt));

  const result = await adminDb.runTransaction(async tx => {
    const [existingEvent, indexSnap] = await Promise.all([tx.get(webhookRef), tx.get(indexRef)]);
    if (existingEvent.exists) return { duplicate: true, matched: true };

    const index = indexSnap.data();
    const communicationRef = index?.userId && index?.dedupeKey
      ? adminDb.collection("users").doc(index.userId).collection("communications").doc(index.dedupeKey)
      : null;
    const communicationSnap = communicationRef ? await tx.get(communicationRef) : null;
    const currentStatus = String(communicationSnap?.data()?.deliveryStatus ?? "sent");
    const nextStatus = (STATUS_RANK[status] ?? 0) >= (STATUS_RANK[currentStatus] ?? 0) ? status : currentStatus;

    tx.create(webhookRef, {
      svixId: id,
      providerId: emailId,
      type: event.type,
      occurredAt,
      receivedAt: FieldValue.serverTimestamp(),
      userId: index?.userId ?? null,
      communicationType: index?.type ?? null,
      category: index?.category ?? null,
      clickUrl: eventData.click?.link?.slice(0, 500) ?? null,
      bounce: eventData.bounce ?? null,
    });
    tx.set(dailyRef, {
      [`communications_${metricKey(status)}`]: FieldValue.increment(1),
      ...(index?.category ? { [`communications_${metricKey(status)}_category_${metricKey(index.category)}`]: FieldValue.increment(1) } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (!communicationRef || !index?.userId) return { duplicate: false, matched: false };
    tx.set(communicationRef, {
      deliveryStatus: nextStatus,
      deliveryEvents: { [`${metricKey(status)}At`]: occurredAt },
      deliveryEventCounts: { [metricKey(status)]: FieldValue.increment(1) },
      lastProviderEventAt: occurredAt,
      updatedAt: FieldValue.serverTimestamp(),
      ...(eventData.bounce ? { bounce: eventData.bounce } : {}),
    }, { merge: true });
    const userRef = adminDb.collection("users").doc(index.userId);
    if (["bounced", "complained", "suppressed"].includes(status)) {
      tx.set(userRef, {
        emailDeliverySuppressed: true,
        emailDeliverySuppressedReason: status,
        emailDeliverySuppressedAt: occurredAt,
      }, { merge: true });
    }
    if (["opened", "clicked"].includes(status)) {
      tx.set(userRef, {
        lastCommunicationEngagement: {
          type: index.type ?? "unknown",
          category: index.category ?? "unknown",
          dedupeKey: index.dedupeKey,
          event: status,
          occurredAt,
        },
      }, { merge: true });
    }
    const analyticsRef = adminDb.collection("analytics_events").doc();
    tx.set(analyticsRef, {
      event: `communication_${status}`,
      user_id: index.userId,
      session_id: null,
      page_path: null,
      params: { type: index.type ?? "unknown", category: index.category ?? "unknown", dedupe_key: index.dedupeKey },
      timestamp: occurredAt,
      source: "resend_webhook",
    });
    return { duplicate: false, matched: true };
  });

  return NextResponse.json({ ok: true, ...result });
}
