import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { wrapEmail, button, heading, paragraph, tipBox } from "@/lib/email-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  return Boolean(token) && (token === process.env.CRON_SECRET || token === process.env.SESSION_API_KEY);
}

function millis(value: unknown): number {
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as any).toMillis === "function") return (value as any).toMillis();
  return Date.parse(String(value ?? ""));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = Date.now();
  const hourAgo = Timestamp.fromMillis(now - 60 * 60_000);
  const dayAgo = Timestamp.fromMillis(now - 24 * 60 * 60_000);
  const [heartbeatSnap, sendingSnap, recentEvents] = await Promise.all([
    adminDb.collection("_system").doc("cron_onboarding_sequence").get(),
    adminDb.collectionGroup("communications").where("status", "==", "sending").limit(250).get(),
    adminDb.collection("analytics_events").where("timestamp", ">=", dayAgo).orderBy("timestamp", "desc").limit(5000).get(),
  ]);

  const staleSending = sendingSnap.docs.filter(doc => now - millis(doc.data().startedAt) > 15 * 60_000).length;
  const events = recentEvents.docs.map(doc => doc.data());
  const lastHour = events.filter(event => millis(event.timestamp) >= hourAgo.toMillis());
  const communicationFailures = lastHour.filter(event => event.event === "communication_failed").length;
  const communicationSent = lastHour.filter(event => event.event === "communication_sent").length;
  const jobStarts = events.filter(event => event.event === "onboarding_job_started").length;
  const jobFailures = events.filter(event => event.event === "onboarding_job_failed").length;
  const searchDurations = events
    .filter(event => event.event === "search_result_revealed")
    .map(event => Number(event.params?.total_search_time_ms))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const p95SearchMs = searchDurations.length ? searchDurations[Math.floor((searchDurations.length - 1) * .95)] : null;
  const heartbeatAgeMs = now - millis(heartbeatSnap.data()?.completedAt ?? heartbeatSnap.data()?.startedAt);
  const alerts: string[] = [];
  if (!Number.isFinite(heartbeatAgeMs) || heartbeatAgeMs > 150 * 60_000) alerts.push("The onboarding lifecycle cron has not completed in the last 150 minutes.");
  if (staleSending > 0) alerts.push(`${staleSending} communication${staleSending === 1 ? " is" : "s are"} stuck in sending for more than 15 minutes.`);
  if (communicationFailures >= 5 && communicationFailures / Math.max(communicationFailures + communicationSent, 1) >= .2) alerts.push(`Communication failures reached ${communicationFailures} in the last hour.`);
  if (jobStarts >= 3 && jobFailures / jobStarts >= .3) alerts.push(`Preview pipeline failure rate is ${Math.round(jobFailures / jobStarts * 100)}% over the last 24 hours.`);
  if (p95SearchMs !== null && p95SearchMs > 4 * 60_000) alerts.push(`Recruiter-search P95 is ${Math.round(p95SearchMs / 1000)} seconds.`);

  const health = {
    status: alerts.length ? "degraded" : "healthy",
    alerts,
    staleSending,
    communicationFailures,
    communicationSent,
    jobStarts,
    jobFailures,
    p95SearchMs,
    checkedAt: FieldValue.serverTimestamp(),
  };
  await adminDb.collection("_system").doc("operational_health").set(health, { merge: true });

  if (alerts.length) await sendAlertOnce(alerts, health.status);
  return NextResponse.json({ ok: true, ...health, checkedAt: new Date().toISOString() });
}

async function sendAlertOnce(alerts: string[], status: string) {
  const recipient = process.env.ANALYTICS_RECIPIENT_EMAIL || process.env.CONTACT_EMAIL;
  if (!recipient || !process.env.RESEND_API_KEY) return;
  const hour = new Date().toISOString().slice(0, 13);
  const fingerprint = alerts.map(item => item.replace(/\d+/g, "#")).sort().join("|").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 140);
  const alertRef = adminDb.collection("_operational_alerts").doc(`${hour}_${fingerprint}`);
  const shouldSend = await adminDb.runTransaction(async tx => {
    const snap = await tx.get(alertRef);
    if (snap.exists) return false;
    tx.create(alertRef, { alerts, status, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!shouldSend) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "CandidAI Monitor <no-reply@candidai.tech>",
    to: recipient,
    subject: `[CandidAI] Onboarding health is ${status}`,
    html: wrapEmail(`
      ${heading("Onboarding needs attention")}
      ${paragraph("The automated health check found conditions that may affect onboarding conversion or email delivery.")}
      ${tipBox(alerts.map(alert => `• ${alert}`).join("<br>"))}
      <div style="text-align:center;margin:32px 0;">${button("Open analytics →", `${process.env.NEXT_PUBLIC_DOMAIN || "https://candidai.tech"}/analytics`)}</div>
    `, { preheader: alerts[0], badge: "OPERATIONAL ALERT" }),
  });
  if (error) throw new Error(JSON.stringify(error));
  await alertRef.set({ sentAt: FieldValue.serverTimestamp() }, { merge: true });
}
