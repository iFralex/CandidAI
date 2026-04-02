import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTokens } from 'next-firebase-auth-edge';
import { clientConfig, serverConfig } from '@/config';
import { adminAuth } from '@/lib/firebase-admin';

export default async function DesktopLoginPage() {
  const cookieStore = await cookies();

  const tokens = await getTokens(cookieStore, {
    apiKey: clientConfig.apiKey,
    cookieName: serverConfig.cookieName,
    cookieSignatureKeys: serverConfig.cookieSignatureKeys,
    serviceAccount: serverConfig.serviceAccount,
  });

  const uid = tokens?.decodedToken?.uid;

  if (!uid) {
    redirect('/login?next=/desktop-login');
  }

  const customToken = await adminAuth.createCustomToken(uid);

  redirect(`candidai://auth?token=${customToken}`);
}
