import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { clientConfig, serverConfig } from "@/config";
import { getTokens } from "next-firebase-auth-edge";

export async function POST(req: NextRequest) {
    try {
        const tokens = await getTokens(req.cookies, {
            apiKey: clientConfig.apiKey,
            cookieName: serverConfig.cookieName,
            cookieSignatureKeys: serverConfig.cookieSignatureKeys,
            serviceAccount: serverConfig.serviceAccount,
        });
        const a = tokens.decodedToken.uid;

        const body = await req.json();

        // Dati inviati dal client
        const { xpayNonce, xpayIdOperazione, xpayTimeStamp, amount, transactionId } = body;

        const apiKey = process.env.NEXT_PUBLIC_NEXI_ALIAS!;
        const chiaveSegreta = process.env.NEXT_PUBLIC_NEXI_SECRET_KEY!;
        const divisa = 978;

        // Calcolo MAC server-side
        const stringaMac = `apiKey=${apiKey}codiceTransazione=${transactionId}importo=${amount}divisa=${divisa}xpayNonce=${xpayNonce}timeStamp=${xpayTimeStamp}${chiaveSegreta}`;
        const mac = crypto.createHash("sha1").update(stringaMac).digest("hex");

        // Chiamata a Nexi
        const response = await fetch("https://ecommerce.nexi.it/ecomm/api/hostedPayments/pagaNonce", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiKey,
                codiceTransazione: transactionId,
                importo: amount,
                divisa,
                xpayNonce,
                timeStamp: xpayTimeStamp,
                mac
            })
        });

        const result = await response.json();
console.log("risposta nexi:", result)
        return NextResponse.json(result);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ esito: "KO", errore: err.message }, { status: 401 });
    }
}
