import { NextResponse, type NextRequest } from 'next/server';
import { refreshNextResponseCookiesWithToken } from 'next-firebase-auth-edge/lib/next/cookies';
import { clientConfig, serverConfig } from '@/config';
import { getTokens } from 'next-firebase-auth-edge';


export async function POST(request: NextRequest) {
    //const token = request.headers.get('Authorization')?.split(' ')[1] ?? '';
    const tokens = await getTokens(request.cookies, {
        apiKey: clientConfig.apiKey,
        cookieName: serverConfig.cookieName,
        cookieSignatureKeys: serverConfig.cookieSignatureKeys,
        serviceAccount: serverConfig.serviceAccount,
    });

    const token = tokens?.token

    if (!token) {
        throw new Error('Unauthenticated');
    }

    return refreshNextResponseCookiesWithToken(
        token,
        request,
        new NextResponse(null, { status: 200 }),
        {
            apiKey: clientConfig.apiKey,
            cookieName: serverConfig.cookieName,
            cookieSignatureKeys: serverConfig.cookieSignatureKeys,
            serviceAccount: serverConfig.serviceAccount,
            // Reuse the canonical cookie options (Secure in production, sameSite=lax)
            // instead of a hardcoded `secure:false`. The old override re-issued the
            // session cookie without the Secure flag on every refresh (verify-email
            // and onboarding), so it could travel over plain HTTP; and its
            // sameSite:'strict' diverged from the app's 'lax', logging users out
            // when arriving from external links.
            cookieSerializeOptions: serverConfig.cookieSerializeOptions,
        }
    );
}