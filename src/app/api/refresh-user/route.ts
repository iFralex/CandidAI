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
    console.log(token)
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
            cookieSerializeOptions: {
                path: '/',
                httpOnly: true,
                secure: false, // Set this to true on HTTPS environments
                sameSite: 'strict' as const,
                maxAge: 12 * 60 * 60 * 24 // twelve days
            },
        }
    );
}