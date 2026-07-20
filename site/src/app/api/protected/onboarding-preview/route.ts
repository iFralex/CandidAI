import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { clientConfig, serverConfig } from "@/config";
import { getTokens } from "next-firebase-auth-edge";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const tokens = await getTokens(request.cookies, {
      apiKey: clientConfig.apiKey,
      cookieName: serverConfig.cookieName,
      cookieSignatureKeys: serverConfig.cookieSignatureKeys,
      serviceAccount: serverConfig.serviceAccount,
    });
    const userId = tokens?.decodedToken?.uid;
    if (!userId) throw new Error("Unauthenticated");
    const snapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("data")
      .doc("onboarding_preview")
      .get();
    return NextResponse.json({
      success: true,
      preview: snapshot.exists
        ? snapshot.data()
        : { status: "idle", stage: "profile_source" },
    });
  } catch (error) {
    console.error("Unable to read onboarding preview", error);
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}
