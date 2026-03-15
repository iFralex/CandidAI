import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { mode, email, password, name } = await req.json();
    const now = new Date().toISOString();

    if (!mode || !["login", "register"].includes(mode)) {
      return NextResponse.json(
        { error: "Missing or invalid mode" },
        { status: 400 }
      );
    }

    let uid: string;

    if (mode === "register") {
      // -----------------------------------------
      // 1️⃣ REGISTER
      // -----------------------------------------
      if (!email || !password) {
        return NextResponse.json(
          { error: "Missing email or password" },
          { status: 400 }
        );
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      try {
        const userRecord = await adminAuth.createUser({
          email,
          password,
          displayName: name,
        });
        uid = userRecord.uid;
      } catch (createErr: any) {
        return NextResponse.json(
          { success: false, error: createErr.message },
          { status: createErr.code === "auth/email-already-exists" ? 400 : 500 }
        );
      }

      // Salva documento Firestore
      await adminDb.collection("users").doc(uid).set({
        name: name ?? "",
        email,
        createdAt: now,
        lastLogin: now,
        onboardingStep: 1,
        plan: "free_trial",
        credits: 0,
        emailVerified: false,
      });

      fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          type: "welcome"
        })
      });

    }

    // -----------------------------------------
    // 2️⃣ LOGIN
    // -----------------------------------------
    // Verifica email/password lato server
    // → Firebase Admin NON può verificare password,
    // quindi usiamo un endpoint esterno: identity toolkit

    const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      const errMsg: string = loginData?.error?.message ?? "AUTH_ERROR";
      const status = errMsg === "USER_DISABLED" ? 403 : 401;
      return NextResponse.json({ success: false, error: errMsg }, { status });
    }

    uid = loginData.localId;
    let idToken = loginData.idToken;

    // Update lastLogin
    await adminDb.collection("users").doc(uid).update({
      lastLogin: now,
    });

    // -----------------------------------------
    // 4️⃣ RISPOSTA API
    // -----------------------------------------
    return NextResponse.json(
      {
        success: true,
        idToken,
        uid,
      },
      { status: 200 }
    );

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
