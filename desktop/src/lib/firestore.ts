import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface EmailItem {
  id: string;
  to: string;
  subject: string;
  body: string;
  cvUrl: string;
  companyName: string;
  recruiterName: string;
  recruiterTitle: string;
}

const EPOCH_MS = new Date('1970-01-01').getTime();

function isUnsent(emailSent: unknown): boolean {
  if (emailSent instanceof Timestamp) {
    return emailSent.toMillis() === EPOCH_MS;
  }
  return false;
}

async function fetchEmails(uid: string, unsentOnly: boolean): Promise<EmailItem[]> {
  const emailsRef = doc(db, `users/${uid}/data/emails`);
  const resultsRef = doc(db, `users/${uid}/data/results`);

  const [emailsSnap, resultsSnap] = await Promise.all([
    getDoc(emailsRef),
    getDoc(resultsRef),
  ]);

  if (!emailsSnap.exists() || !resultsSnap.exists()) {
    return [];
  }

  const emailsData = emailsSnap.data() as Record<string, {
    subject?: string;
    body?: string;
    email_address?: string;
    cv_url?: string;
  }>;

  const resultsData = resultsSnap.data() as Record<string, {
    email_sent?: Timestamp;
    company?: { name?: string };
    recruiter?: { name?: string; job_title?: string };
  }>;

  const items: EmailItem[] = [];

  for (const id of Object.keys(emailsData)) {
    const email = emailsData[id];
    const result = resultsData[id];

    if (!result) continue;
    if (unsentOnly && !isUnsent(result.email_sent)) continue;

    items.push({
      id,
      to: email.email_address ?? '',
      subject: email.subject ?? '',
      body: email.body ?? '',
      cvUrl: email.cv_url ?? '',
      companyName: result.company?.name ?? '',
      recruiterName: result.recruiter?.name ?? '',
      recruiterTitle: result.recruiter?.job_title ?? '',
    });
  }

  return items;
}

export function getUnsentEmails(uid: string): Promise<EmailItem[]> {
  return fetchEmails(uid, true);
}

export function getAllEmails(uid: string): Promise<EmailItem[]> {
  return fetchEmails(uid, false);
}

export async function updateEmailSent(uid: string, uniqueId: string, sent: boolean): Promise<void> {
  const ref = doc(db, `users/${uid}/data/results`);
  const value = sent
    ? serverTimestamp()
    : Timestamp.fromDate(new Date('1970-01-01'));

  await setDoc(ref, { [uniqueId]: { email_sent: value } }, { merge: true });
}

export async function updateEmailContent(
  uid: string,
  uniqueId: string,
  patch: Partial<Pick<EmailItem, 'subject' | 'body' | 'to'>>
): Promise<void> {
  const ref = doc(db, `users/${uid}/data/emails`);
  const firestorePatch: Record<string, string> = {};

  if (patch.subject !== undefined) firestorePatch.subject = patch.subject;
  if (patch.body !== undefined) firestorePatch.body = patch.body;
  if (patch.to !== undefined) firestorePatch.email_address = patch.to;

  await setDoc(ref, { [uniqueId]: firestorePatch }, { merge: true });
}
