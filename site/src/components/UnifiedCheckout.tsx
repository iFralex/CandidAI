'use client'

import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    PaymentRequestButtonElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { computePriceInCents, formatPrice, getPlanById, getDiscountCode, applyDiscount, type ResolvedDiscount } from "@/lib/utils";
import { CREDIT_PACKAGES } from "@/config";
import { track, refreshUserPropertiesFromFirestore, saveLastTouchToUserDoc } from "@/lib/analytics";

const TERMS_VERSION = "2026-07-19";

/** Discount as held by the checkout state — includes the canonical code
 *  string so we can pass it to payment endpoints for server-side re-validation. */
interface AppliedDiscount extends ResolvedDiscount {
    code: string;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const elementOptions = {
    style: {
        base: {
            color: "#fff",
            fontSize: "16px",
            fontFamily: "Inter, sans-serif",
            "::placeholder": { color: "#9ca3af" },
        },
        invalid: { color: "#f87171", iconColor: "#f87171" },
    },
};

function StripeCardInputs() {
    return (
        <div className="space-y-3">
            <label className="block">
                <div className="text-sm text-gray-300 mb-2">Card number</div>
                <div className="p-3 bg-white/6 rounded-full border border-white/12 focus-within:ring-2 focus-within:ring-violet-500">
                    <CardNumberElement options={elementOptions} />
                </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label>
                    <div className="text-sm text-gray-300 mb-2">Expiry</div>
                    <div className="p-3 bg-white/6 rounded-full border border-white/12 focus-within:ring-2 focus-within:ring-violet-500">
                        <CardExpiryElement options={elementOptions} />
                    </div>
                </label>
                <label>
                    <div className="text-sm text-gray-300 mb-2">CVC</div>
                    <div className="p-3 bg-white/6 rounded-full border border-white/12 focus-within:ring-2 focus-within:ring-violet-500">
                        <CardCvcElement options={elementOptions} />
                    </div>
                </label>
            </div>
        </div>
    );
}

async function confirmPaymentAndNavigate(
    paymentIntentId: string,
    onSuccess?: (data: any) => void,
    data?: any,
    analyticsParams?: { type: "plan" | "credits"; item_id: string; amount_cents: number }
) {
    try {
        await fetch("/api/payment-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentIntentId }),
        });
    } catch { /* webhook will handle it as fallback */ }

    if (analyticsParams) {
        track({ name: "checkout_success", params: analyticsParams });
        // Pull every fresh user property (plan, credits, onboardingStep, is_paid)
        // from Firestore — the payment-confirm route has already updated the doc.
        void refreshUserPropertiesFromFirestore();
        // Credit this conversion to whatever campaign drove the latest visit.
        void saveLastTouchToUserDoc();
    }

    if (onSuccess) {
        onSuccess(data);
    } else {
        window.location.href = "/dashboard";
    }
}

interface PaymentRequestButtonProps {
    email: string;
    amountCents: number;
    purchaseType: "plan" | "credits";
    itemId: string;
    discount?: AppliedDiscount | null;
    onSuccess?: (data: any) => void;
    consentGranted: boolean;
}

function PaymentRequestButton({ email, amountCents, purchaseType, itemId, discount, onSuccess, consentGranted }: PaymentRequestButtonProps) {
    const discountCode = discount?.code ?? null;
    const stripe = useStripe();
    const [paymentRequest, setPaymentRequest] = useState<any>(null);
    const [supported, setSupported] = useState(false);
    const [walletLabel, setWalletLabel] = useState("Express checkout");

    useEffect(() => {
        if (!stripe) return;

        const pr = stripe.paymentRequest({
            country: "IT",
            currency: "eur",
            total: { label: "Purchase", amount: amountCents },
            requestPayerEmail: true,
        });

        pr.canMakePayment().then((res) => {
            if (res) {
                setSupported(true);
                setWalletLabel(res.applePay ? "Apple Pay" : res.googlePay ? "Google Pay" : "Express checkout");
            }
        });

        pr.on("paymentmethod", async (ev) => {
            try {
                const res = await fetch("/api/create-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        payment_method_id: ev.paymentMethod.id,
                        purchaseType,
                        itemId,
                        discountCode,
                        acceptedTerms: true,
                        requestedImmediatePerformance: true,
                        termsVersion: TERMS_VERSION,
                    }),
                });
                const data = await res.json();
                if (data.error) { ev.complete("fail"); return; }

                const { error: confirmError } = await stripe.confirmCardPayment(
                    data.client_secret,
                    { payment_method: ev.paymentMethod.id },
                    { handleActions: true }
                );

                if (confirmError) {
                    ev.complete("fail");
                } else {
                    ev.complete("success");
                    await confirmPaymentAndNavigate(data.paymentIntentId, onSuccess, data, { type: purchaseType, item_id: itemId, amount_cents: amountCents });
                }
            } catch {
                ev.complete("fail");
            }
        });

        setPaymentRequest(pr);
        return () => { try { pr?.off?.("paymentmethod"); } catch { } };
    }, [stripe, amountCents, purchaseType, itemId, discountCode]);

    if (!supported || !paymentRequest) return null;

    if (!consentGranted) {
        return (
            <div className="mb-4 space-y-2">
                <div aria-disabled="true" className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-semibold text-black opacity-60">
                    <Lock className="h-3.5 w-3.5" />
                    {walletLabel} available
                </div>
                <p className="text-center text-xs text-gray-500">Accept the terms below to unlock {walletLabel}.</p>
            </div>
        );
    }

    return (
        <div className="mb-4">
            <PaymentRequestButtonElement options={{ paymentRequest }} />
        </div>
    );
}

interface CheckoutFormProps {
    email: string;
    purchaseType: "plan" | "credits";
    itemId: string;
    discount?: AppliedDiscount | null;
    onSuccess?: (data: any) => void;
}

function CheckoutForm({ email, purchaseType, itemId, discount, onSuccess }: CheckoutFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [consentGranted, setConsentGranted] = useState(false);

    const discountCode = discount?.code ?? null;
    const baseAmountCents = computePriceInCents(purchaseType, itemId);
    const amountCents = applyDiscount(baseAmountCents, discount);

    const isFree = amountCents < 100;

    const handlePay = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!consentGranted) {
            setError("Please accept the Terms and request immediate performance before purchasing.");
            return;
        }
        setLoading(true);
        setError("");

        track({ name: "checkout_submit", params: { type: purchaseType, item_id: itemId, amount_cents: amountCents } });

        try {
            if (isFree) {
                const res = await fetch("/api/create-payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ purchaseType, itemId, discountCode, acceptedTerms: true, requestedImmediatePerformance: true, termsVersion: TERMS_VERSION }),
                });
                const data = await res.json();
                if (data.error) { setError(data.error); setLoading(false); return; }
                setSuccess(true);
                setLoading(false);
                track({ name: "checkout_free_success", params: { item_id: itemId } });
                void refreshUserPropertiesFromFirestore();
                void saveLastTouchToUserDoc();
                if (onSuccess) onSuccess(data); else window.location.href = "/dashboard";
                return;
            }

            if (!stripe || !elements) return;

            const cardNumberElement = elements.getElement(CardNumberElement);
            if (!cardNumberElement) {
                setError("Card element not available");
                setLoading(false);
                return;
            }

            const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
                type: "card",
                card: cardNumberElement,
                billing_details: { email },
            });

            if (pmError) {
                track({ name: "checkout_error", params: { error_message: pmError.message ?? "pm_error", item_id: itemId } });
                setError(pmError.message || "Payment method error");
                setLoading(false);
                return;
            }

            const res = await fetch("/api/create-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payment_method_id: paymentMethod!.id, purchaseType, itemId, discountCode, acceptedTerms: true, requestedImmediatePerformance: true, termsVersion: TERMS_VERSION }),
            });

            const data = await res.json();
            if (data.error) {
                track({ name: "checkout_error", params: { error_message: data.error, item_id: itemId } });
                setError(data.error);
                setLoading(false);
                return;
            }

            const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret);
            if (confirmError) {
                track({ name: "checkout_error", params: { error_message: confirmError.message ?? "confirm_error", item_id: itemId } });
                setError(confirmError.message || "Payment confirmation failed");
                setLoading(false);
                return;
            }

            setSuccess(true);
            setLoading(false);
            await confirmPaymentAndNavigate(data.paymentIntentId, onSuccess, data, { type: purchaseType, item_id: itemId, amount_cents: amountCents });
        } catch (err: any) {
            track({ name: "checkout_error", params: { error_message: err.message ?? "unexpected_error", item_id: itemId } });
            setError(err.message || "Unexpected error");
            setLoading(false);
        }
    };

    if (success) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6">
                <Card className="p-4 bg-emerald-900/10 border-emerald-700">
                    <div className="flex items-center gap-3">
                        <Check className="w-6 h-6 text-emerald-400" />
                        <div>
                            <div className="text-sm text-white font-medium">Payment successful!</div>
                            <div className="text-xs text-gray-300">A receipt has been sent to {email}</div>
                        </div>
                    </div>
                </Card>
            </motion.div>
        );
    }

    return (
        <form onSubmit={handlePay} className="space-y-6">
            {!isFree && (
                <>
                    <PaymentRequestButton
                        email={email}
                        amountCents={amountCents}
                        purchaseType={purchaseType}
                        itemId={itemId}
                        discount={discount}
                        onSuccess={onSuccess}
                        consentGranted={consentGranted}
                    />
                    <StripeCardInputs />
                </>
            )}

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <Separator />

            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">Total</div>
                <div className="text-white font-bold text-lg">{formatPrice(amountCents)}</div>
            </div>

            <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-300">
                <input
                    type="checkbox"
                    checked={consentGranted}
                    onChange={(event) => {
                        setConsentGranted(event.target.checked);
                        if (event.target.checked) setError("");
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
                />
                <span>
                    I accept the <a href="/docs/terms-of-service" target="_blank" className="text-violet-300 underline">Terms of Service</a> and expressly request CandidAI to start processing immediately. I understand that this may affect or end my statutory withdrawal right once the service has been fully performed, as explained in the Terms.
                </span>
            </label>

            <Button className="w-full" onClick={handlePay} disabled={loading || !consentGranted}>
                {loading ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                    </span>
                ) : isFree ? (
                    <span className="flex items-center gap-2">
                        Confirm free purchase <ArrowRight className="w-4 h-4" />
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        Pay {formatPrice(amountCents)} <ArrowRight className="w-4 h-4" />
                    </span>
                )}
            </Button>
        </form>
    );
}

interface PurchaseSummaryProps {
    purchaseType: "plan" | "credits";
    itemId: string;
    discount?: AppliedDiscount | null;
}

function PurchaseSummary({ purchaseType, itemId, discount }: PurchaseSummaryProps) {
    const baseAmountCents = computePriceInCents(purchaseType, itemId);
    const amountCents = applyDiscount(baseAmountCents, discount);
    const hasDiscount = !!discount && amountCents !== baseAmountCents;

    if (purchaseType === "credits") {
        const pkg = CREDIT_PACKAGES.find((p) => p.id === itemId);
        if (!pkg) return null;
        return (
            <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-white font-semibold">{pkg.credits.toLocaleString()} Credits</div>
                        <div className="text-sm text-gray-400">One-time purchase</div>
                    </div>
                    <div className="text-right">
                        {hasDiscount && <div className="text-sm text-gray-400 line-through">{formatPrice(baseAmountCents)}</div>}
                        <div className="text-white font-bold text-xl">{formatPrice(amountCents)}</div>
                    </div>
                </div>
            </Card>
        );
    }

    const plan = getPlanById(itemId);
    if (!plan) return null;

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-white font-semibold">{plan.name} Plan</div>
                    <div className="text-sm text-gray-400">{plan.description}</div>
                </div>
                <div className="text-right">
                    {hasDiscount && <div className="text-sm text-gray-400 line-through">{formatPrice(baseAmountCents)}</div>}
                    <div className="text-white font-bold text-xl">{formatPrice(amountCents)}</div>
                </div>
            </div>
            <ul className="space-y-1">
                {plan.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                        {feature}
                    </li>
                ))}
            </ul>
        </Card>
    );
}

// ─── Discount code input ───────────────────────────────────────────────────

/** Server-validated discount applied to the checkout (or null = none). */
interface DiscountCodeInputProps {
    purchaseType: "plan" | "credits";
    itemId: string;
    value: AppliedDiscount | null;
    onApply: (discount: AppliedDiscount) => void;
    onRemove: () => void;
}

type ValidationErrorReason = "unknown" | "disabled" | "expired" | "max_uses_reached";
const VALIDATION_ERROR_COPY: Record<ValidationErrorReason, string> = {
    unknown: "This code isn't valid.",
    disabled: "This code has been disabled.",
    expired: "This code has expired.",
    max_uses_reached: "This code has reached its usage limit.",
};

async function validateRemote(code: string): Promise<{ valid: true; code: string; type: "percentage" | "fixed"; value: number } | { valid: false; reason: ValidationErrorReason }> {
    try {
        const r = await fetch("/api/discount/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        });
        return await r.json();
    } catch {
        return { valid: false, reason: "unknown" };
    }
}

function DiscountCodeInput({ purchaseType, itemId, value, onApply, onRemove }: DiscountCodeInputProps) {
    const [expanded, setExpanded] = useState(false);
    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Already-applied state: compact badge with Remove
    if (value) {
        const baseAmount = computePriceInCents(purchaseType, itemId);
        const finalAmount = applyDiscount(baseAmount, value);
        const saved = baseAmount - finalAmount;
        return (
            <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <div className="min-w-0">
                            <div className="text-sm text-white font-medium truncate">
                                Code <code className="text-violet-300 font-mono">{value.code}</code> applied
                            </div>
                            {saved > 0 && (
                                <div className="text-xs text-gray-400">You save {formatPrice(saved)}</div>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="text-xs text-gray-400 hover:text-white underline flex-shrink-0"
                    >
                        Remove
                    </button>
                </div>
            </Card>
        );
    }

    // Collapsed link state
    if (!expanded) {
        return (
            <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-sm text-gray-400 hover:text-white underline w-full text-left"
            >
                Have a discount code?
            </button>
        );
    }

    // Expanded input state
    const handleApply = async () => {
        const code = input.trim();
        if (!code || submitting) return;
        setSubmitting(true);
        setError(null);
        const res = await validateRemote(code);
        setSubmitting(false);
        if (!res.valid) {
            setError(VALIDATION_ERROR_COPY[res.reason] ?? VALIDATION_ERROR_COPY.unknown);
            return;
        }
        setInput("");
        setExpanded(false);
        onApply({ code: res.code, type: res.type, value: res.value });
    };

    return (
        <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm text-white font-medium">Discount code</label>
                <button
                    type="button"
                    onClick={() => { setExpanded(false); setError(null); setInput(""); }}
                    className="text-xs text-gray-500 hover:text-white"
                >
                    Cancel
                </button>
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => { setInput(e.target.value); if (error) setError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApply(); } }}
                    placeholder="e.g. WELCOME15"
                    autoFocus
                    disabled={submitting}
                    className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-400/60 font-mono disabled:opacity-50"
                />
                <Button type="button" onClick={handleApply} disabled={!input.trim() || submitting}>
                    {submitting ? "..." : "Apply"}
                </Button>
            </div>
            {error && <div className="text-xs text-red-400">{error}</div>}
        </Card>
    );
}

export interface UnifiedCheckoutProps {
    purchaseType: "plan" | "credits";
    itemId: string;
    email?: string;
    onSuccess?: (data: any) => void;
}

export function UnifiedCheckout({ purchaseType, itemId, email = "", onSuccess }: UnifiedCheckoutProps) {
    const [discount, setDiscount] = useState<AppliedDiscount | null>(null);

    useEffect(() => {
        // Cookie may hold a code that the user landed with (?discount=CODE
        // captured by middleware). We don't trust it blindly — validate
        // server-side first; if invalid/expired/disabled, clear the cookie.
        const cookieCode = getDiscountCode();
        const baseAmount = computePriceInCents(purchaseType, itemId);
        if (!cookieCode) {
            track({ name: "checkout_open", params: { type: purchaseType, item_id: itemId, amount_cents: baseAmount } });
            return;
        }
        let cancelled = false;
        validateRemote(cookieCode).then((res) => {
            if (cancelled) return;
            if (res.valid) {
                const applied: AppliedDiscount = { code: res.code, type: res.type, value: res.value };
                setDiscount(applied);
                const finalAmount = applyDiscount(baseAmount, applied);
                track({ name: "checkout_open", params: { type: purchaseType, item_id: itemId, amount_cents: finalAmount } });
                track({ name: "discount_code_apply", params: { code: applied.code, discount_type: "auto", discount_value: baseAmount - finalAmount } });
            } else {
                // Stale/invalid cookie — clear it so we don't keep retrying
                document.cookie = "discount=; path=/; max-age=0";
                track({ name: "checkout_open", params: { type: purchaseType, item_id: itemId, amount_cents: baseAmount } });
            }
        });
        return () => { cancelled = true; };
    }, [purchaseType, itemId]);

    const handleApply = (applied: AppliedDiscount) => {
        setDiscount(applied);
        document.cookie = `discount=${encodeURIComponent(applied.code)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
        const baseAmount = computePriceInCents(purchaseType, itemId);
        const finalAmount = applyDiscount(baseAmount, applied);
        track({ name: "discount_code_apply", params: { code: applied.code, discount_type: "manual", discount_value: baseAmount - finalAmount } });
    };

    const handleRemove = () => {
        setDiscount(null);
        document.cookie = "discount=; path=/; max-age=0";
    };

    return (
        <div className="no-scrollbar overflow-y-auto space-y-4">
            <Elements stripe={stripePromise}>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <PurchaseSummary purchaseType={purchaseType} itemId={itemId} discount={discount} />
                        <DiscountCodeInput
                            purchaseType={purchaseType}
                            itemId={itemId}
                            value={discount}
                            onApply={handleApply}
                            onRemove={handleRemove}
                        />
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-300">Payment method</div>
                                <Badge className="bg-slate-700/30">Secure <Lock className="w-3 h-3 ml-1" /></Badge>
                            </div>
                            <div className="mt-3 text-xs text-gray-400">
                                Card details are processed securely by Stripe, we never see full card numbers.
                            </div>
                        </Card>
                    </div>

                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Payment details</h3>
                        <CheckoutForm
                            email={email}
                            purchaseType={purchaseType}
                            itemId={itemId}
                            discount={discount}
                            onSuccess={onSuccess}
                        />
                    </Card>
                </div>
            </Elements>
        </div>
    );
}
