import { Resend } from "resend";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { userId, type } = await req.json();

    if (!userId || !type) {
      return NextResponse.json(
        { error: "Missing userId or type" },
        { status: 400 }
      );
    }

    // --- Get user from Firebase Auth ---
    const userRecord = await adminAuth.getUser(userId);
    const email = userRecord.email;

    if (!email) {
      return NextResponse.json(
        { error: "User has no email" },
        { status: 404 }
      );
    }

    // --- Email templates based on type ---
    let subject = "";
    let html = "";

    switch (type) {
      case "welcome":
        subject = "Benvenuto su CandidAI!";
        html = `
          <h1>Ciao!</h1>
          <p>Grazie per esserti unito a CandidAI.</p>
        `;
        break;

      case "password-reset":
        subject = "Richiesta reset password";
        html = `
          <h1>Reset della password</h1>
          <p>Abbiamo ricevuto una richiesta per reimpostare la tua password.</p>
        `;
        break;

      case "approved":
        subject = "La tua candidatura è stata approvata!";
        html = `
          <h1>Complimenti!</h1>
          <p>La tua candidatura è stata approvata.</p>
        `;
        break;

      default:
        return NextResponse.json(
          { error: "Unknown email type" },
          { status: 400 }
        );
    }

    // --- Send email via Resend ---
    const result = await resend.emails.send({
      from: "CandidAI <no-reply@candidai.tech>",
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ success: true, result });

  } catch (err) {
    console.error("Email API Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err.message },
      { status: 500 }
    );
  }
}
