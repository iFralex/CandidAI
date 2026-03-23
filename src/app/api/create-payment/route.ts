// app/api/create-payment/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { plansInfo, CREDIT_PACKAGES } from "@/config";
import { applyDiscount } from "@/lib/utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-08-16" });

export async function POST(req: Request) {
    const { payment_method_id, purchaseType, itemId, discountCode } = await req.json();

    if (!payment_method_id || !purchaseType || !itemId) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const res = await fetch(process.env.NEXT_PUBLIC_DOMAIN + "/api/protected/user", {
            credentials: "include",
            cache: "no-cache",
            headers: {
                cookie: (await cookies()).toString()
            }
        });

        if (!res.ok) {
            return NextResponse.json({ error: "Authentication failed" }, { status: res.status });
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const user = data.user;
        if (!user) throw new Error("Utente non autenticato");

        let amountInCents: number;

        if (purchaseType === "plan") {
            const plan = plansInfo.find((p) => p.id === itemId);
            if (!plan) return NextResponse.json({ error: "Piano non valido" }, { status: 400 });
            amountInCents = Math.round(plan.price * 100);
            if (amountInCents === 0) {
                return NextResponse.json({ error: "Free plans do not require payment" }, { status: 400 });
            }
        } else if (purchaseType === "credits") {
            const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
            if (!pkg) return NextResponse.json({ error: "Pacchetto crediti non valido" }, { status: 400 });
            amountInCents = pkg.price;
        } else {
            return NextResponse.json({ error: "purchaseType non valido" }, { status: 400 });
        }

        if (discountCode) {
            amountInCents = applyDiscount(amountInCents, discountCode);
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: "eur",
            payment_method: payment_method_id,
            confirm: false,
            metadata: {
                userId: user.uid,
                purchaseType,
                itemId,
            },
        });

        return NextResponse.json({
            client_secret: paymentIntent.client_secret,
            type: "one_time",
            amount: amountInCents,
        });

    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
