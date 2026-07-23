// app/api/protected/user/result/[resultId]/route.js
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { clientConfig, serverConfig } from '@/config';
import { getTokens } from 'next-firebase-auth-edge';
import { getTestMock } from '@/app/api/test/set-mock/route';

export async function GET(request, { params }) {
    // Test bypass
    if (process.env.NODE_ENV !== 'production') {
        const urlPath = new URL(request.url).pathname;
        const mock = getTestMock(urlPath);
        if (mock) return NextResponse.json(mock);
        // Cookie bypass: return empty-but-valid response so SSR doesn't crash
        if (request.cookies.get('__playwright_user__')?.value) {
            return NextResponse.json({ success: true, details: {}, customizations: { instructions: null, queries: null } });
        }
    }

    let decodedToken;

    try {
        // Autentica l'utente tramite cookie Firebase
        const tokens = await getTokens(request.cookies, {
            apiKey: clientConfig.apiKey,
            cookieName: serverConfig.cookieName,
            cookieSignatureKeys: serverConfig.cookieSignatureKeys,
            serviceAccount: serverConfig.serviceAccount,
        });

        if (!tokens?.decodedToken) {
            return NextResponse.json(
                { error: 'Non autorizzato' },
                { status: 401 }
            );
        }

        decodedToken = tokens.decodedToken;
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json(
            { error: 'Non autorizzato' },
            { status: 401 }
        );
    }

    try {
        const { resultId } = await params;
        const userId = decodedToken.uid;

        // Percorso Firestore:
        // users/{userId}/data/results/{resultId}/details
        const detailsRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(resultId)
            .doc("details");

        const customizationsRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(resultId)
            .doc("customizations")

        const unlockedRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(resultId)
            .doc("unlocked")

        const followUpRef = adminDb
            .collection("users")
            .doc(userId)
            .collection("data")
            .doc("results")
            .collection(resultId)
            .doc("follow_up")

        const userRef = adminDb.collection("users").doc(userId)

        // 🔹 Fetch parallelo
        const [detailsDoc, customizationsDoc, unlockedDoc, followUpDoc, userDoc] = await Promise.all([
            detailsRef.get(),
            customizationsRef.get(),
            unlockedRef.get(),
            followUpRef.get(),
            userRef.get(),
        ]);

        // 🔹 Dati estratti
        if (!detailsDoc.exists) {
            return NextResponse.json(
                { error: 'Result not found' },
                { status: 404 }
            );
        }

        const detailsData = detailsDoc.data();
        const unlocked = unlockedDoc.exists ? unlockedDoc.data() : {};
        const customizationsData = customizationsDoc.exists
            ? customizationsDoc.data()
            : {};

        if (!unlocked.prompt && detailsData.email) detailsData.email.prompt = null
        if (!unlocked["generate-email"]) customizationsData.instructions = null
        if (!unlocked["find-recruiter"]) customizationsData.queries = null
        customizationsData.blogSearch = unlocked["research-blog-articles"] ? true : null

        // 🔹 Risposta finale
        return NextResponse.json({
            success: true,
            details: detailsData,
            customizations: customizationsData,
            follow_up: followUpDoc.exists ? followUpDoc.data() : null,
            plan: userDoc.data()?.plan || "free_trial",
            user_email: userDoc.data()?.email || "",
        });

    } catch (error) {
        console.error('Firestore error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
