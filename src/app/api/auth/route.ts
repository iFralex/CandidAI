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
    let idToken: string;

    if (mode === "register") {
      // -----------------------------------------
      // 1️⃣ REGISTER
      // -----------------------------------------
      const userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      });

      uid = userRecord.uid;

      // Salva documento Firestore
      await adminDb.collection("users").doc(uid).set({
        name,
        email,
        createdAt: now,
        lastLogin: now,
      });

      // Token da passare a /api/login
      idToken = await adminAuth.createCustomToken(uid);

      fetch(`${process.env.NEXT_PUBLIC_DOMAIN}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          type: "welcome"
        })
      });

    } else {
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
        return NextResponse.json({ error: loginData.error.message }, { status: 401 });
      }

      uid = loginData.localId;
      idToken = loginData.idToken;

      // Update lastLogin
      await adminDb.collection("users").doc(uid).update({
        lastLogin: now,
      });
    }

    console.log(mode, uid)

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
