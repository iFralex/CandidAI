/**
 * POST /api/discount/validate
 *
 * Client-callable endpoint. Returns the resolved discount object for the UI
 * to compute the displayed price; the server payment endpoints re-validate
 * independently at payment time, so a malicious client gains nothing by
 * lying about validation here.
 *
 * No auth required — discount codes aren't secrets, and rate-limiting at
 * the platform edge is sufficient for the volumes we expect.
 */
import { NextRequest, NextResponse } from "next/server";
import { validateDiscountCode } from "@/lib/discount-codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    let code: string;
    try {
        const body = await req.json();
        code = String(body.code ?? "").trim();
    } catch {
        return NextResponse.json({ valid: false, error: "invalid_request" }, { status: 400 });
    }
    if (!code) return NextResponse.json({ valid: false, error: "empty" }, { status: 400 });

    const result = await validateDiscountCode(code);
    if (!result.valid) {
        return NextResponse.json({ valid: false, reason: result.reason });
    }
    return NextResponse.json({
        valid: true,
        code: result.discount.code,        // canonical display case (e.g. WELCOME15)
        type: result.discount.type,
        value: result.discount.value,
    });
}
